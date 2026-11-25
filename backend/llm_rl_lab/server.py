"""FastAPI + WebSocket local backend with localhost-only token auth and static UI hosting."""

from __future__ import annotations

import asyncio
import json
import secrets
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import PRESETS, detect_device_telemetry
from .sandbox import dry_run_user_code
from .schema import DryRunRequest, DryRunResult, StartTrainRequest
from .trainer import MockTrainer, RealGPUTrainer


def create_app(
    *,
    auth_token: str | None = None,
    mock_mode: bool = False,
    runs_dir: Path | None = None,
    static_dir: Path | None = None,
) -> FastAPI:
    token = auth_token or secrets.token_urlsafe(24)
    runs_path = runs_dir or Path("runs")
    static_path = static_dir or (Path(__file__).parent / "static")

    app = FastAPI(title="LLM RL Lab Local Backend", version="0.1.0")
    app.state.auth_token = token
    app.state.mock_mode = mock_mode
    app.state.runs_dir = runs_path
    app.state.active_task: asyncio.Task[Any] | None = None
    app.state.cancel_event: asyncio.Event | None = None
    app.state.ws_clients: set[WebSocket] = set()
    app.state.trainer = MockTrainer() if mock_mode else RealGPUTrainer()

    # Strict localhost CORS to prevent arbitrary third-party websites from calling the local server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8765",
            "http://localhost:8765",
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Lab-Token"],
    )

    def verify_token(
        x_lab_token: str | None = Header(default=None),
        query_token: str | None = Query(default=None, alias="token"),
    ) -> None:
        provided = x_lab_token or query_token
        if not provided or not secrets.compare_digest(provided, app.state.auth_token):
            raise HTTPException(status_code=401, detail="Invalid or missing lab session token")

    async def broadcast(event: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        payload = json.dumps(event, ensure_ascii=False)
        for ws in list(app.state.ws_clients):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            app.state.ws_clients.discard(ws)

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "mock_mode": app.state.mock_mode,
            "running": app.state.active_task is not None and not app.state.active_task.done(),
        }

    @app.get("/api/device", dependencies=[Depends(verify_token)])
    def device_info() -> dict[str, Any]:
        return detect_device_telemetry(mock_mode=app.state.mock_mode).model_dump()

    @app.get("/api/presets", dependencies=[Depends(verify_token)])
    def list_presets() -> list[dict[str, Any]]:
        return [
            {
                "preset_id": p.preset_id,
                "lesson_id": p.lesson_id,
                "algorithm": p.algorithm,
                "group_size": p.group_size,
                "kl_beta": p.kl_beta,
                "clip_eps": p.clip_eps,
                "update_epochs": p.update_epochs,
                "use_format_reward": p.use_format_reward,
                "check_numbers_exact": p.check_numbers_exact,
                "reward_shift": p.reward_shift,
            }
            for p in PRESETS.values()
        ]

    @app.post("/api/dry-run", response_model=DryRunResult, dependencies=[Depends(verify_token)])
    def run_dry_check(req: DryRunRequest) -> DryRunResult:
        return dry_run_user_code(req.lesson_id, req.code)

    @app.post("/api/train/start", dependencies=[Depends(verify_token)])
    async def start_train(req: StartTrainRequest) -> dict[str, Any]:
        if app.state.active_task and not app.state.active_task.done():
            raise HTTPException(status_code=409, detail="A training run is already in progress")

        if req.custom_code:
            check = dry_run_user_code(req.lesson_id, req.custom_code)
            if not check.ok:
                raise HTTPException(status_code=400, detail=f"Dry-run failed: {check.summary}")

        cancel_event = asyncio.Event()
        app.state.cancel_event = cancel_event

        async def _runner() -> None:
            try:
                await app.state.trainer.run(req, broadcast, cancel_event, app.state.runs_dir)
            except Exception as exc:
                await broadcast({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

        app.state.active_task = asyncio.create_task(_runner())
        return {"started": True, "preset_id": req.preset_id, "mock_mode": app.state.mock_mode}

    @app.post("/api/train/stop", dependencies=[Depends(verify_token)])
    async def stop_train() -> dict[str, Any]:
        if app.state.cancel_event:
            app.state.cancel_event.set()
        return {"stopping": True}

    @app.get("/api/runs", dependencies=[Depends(verify_token)])
    def list_runs() -> list[dict[str, Any]]:
        if not app.state.runs_dir.exists():
            return []
        items = []
        for path in sorted(app.state.runs_dir.glob("*.json"), reverse=True)[:20]:
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                items.append(
                    {
                        "run_id": raw.get("metadata", {}).get("run_id", path.stem),
                        "preset_id": raw.get("metadata", {}).get("preset_id", ""),
                        "steps": len(raw.get("steps", [])),
                        "created_at": raw.get("metadata", {}).get("created_at", ""),
                    }
                )
            except Exception:
                continue
        return items

    @app.get("/api/runs/{run_id}", dependencies=[Depends(verify_token)])
    def get_run(run_id: str) -> dict[str, Any]:
        safe_name = Path(run_id).name
        target = app.state.runs_dir / f"{safe_name}.json"
        if not target.exists():
            raise HTTPException(status_code=404, detail="Run not found")
        return json.loads(target.read_text(encoding="utf-8"))

    @app.websocket("/ws/train")
    async def ws_train(ws: WebSocket, token_q: str = Query(default="", alias="token")) -> None:
        if not secrets.compare_digest(token_q, app.state.auth_token):
            await ws.close(code=4401, reason="Unauthorized")
            return
        await ws.accept()
        app.state.ws_clients.add(ws)
        try:
            await ws.send_text(
                json.dumps(
                    {
                        "type": "connected",
                        "device": detect_device_telemetry(mock_mode=app.state.mock_mode).model_dump(),
                    }
                )
            )
            while True:
                # Keepalive / ignore client pings
                await ws.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            app.state.ws_clients.discard(ws)

    # Serve pre-built frontend bundle when distributed as a single Python package (`uvx llm-rl-lab`)
    if static_path.exists() and (static_path / "index.html").exists():
        assets_dir = static_path / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}")
        def serve_spa(full_path: str) -> FileResponse:
            candidate = static_path / full_path
            if full_path and candidate.exists() and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(static_path / "index.html")

    return app
