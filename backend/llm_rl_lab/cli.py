"""CLI entry point for `llm-rl-lab` (serve, generate-demo, info)."""

from __future__ import annotations

import argparse
import secrets
import webbrowser
from pathlib import Path

import uvicorn

from .config import detect_device_telemetry
from .demo_data import export_all_demo_runs
from .server import create_app


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="llm-rl-lab",
        description="Interactive 8GB-VRAM LLM RL learning lab (REINFORCE, GRPO, DPO on Countdown).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_serve = sub.add_parser("serve", help="Start local FastAPI + WebSocket lab server on 127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8765)
    p_serve.add_argument("--token", type=str, default=None, help="Optional fixed session token")
    p_serve.add_argument("--mock", action="store_true", help="Run CPU mock trainer instead of GPU PyTorch")
    p_serve.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    p_serve.add_argument("--runs-dir", type=Path, default=Path("runs"))

    p_demo = sub.add_parser("generate-demo", help="Regenerate static demoRuns.json from Pydantic schema")
    p_demo.add_argument(
        "--out",
        type=Path,
        default=Path("frontend/src/data/demoRuns.json"),
    )
    p_demo.add_argument("--steps", type=int, default=45)

    sub.add_parser("info", help="Print detected GPU / dtype / package readiness")

    args = parser.parse_args()

    if args.command == "info":
        info = detect_device_telemetry(mock_mode=False)
        print(info.model_dump_json(indent=2))
        return

    if args.command == "generate-demo":
        runs = export_all_demo_runs(args.out, num_steps=args.steps)
        print(f"Exported {len(runs)} preset runs ({args.steps} steps each) to {args.out}")
        return

    if args.command == "serve":
        token = args.token or secrets.token_urlsafe(18)
        url = f"http://127.0.0.1:{args.port}/?token={token}"
        print(f"\n  LLM RL Lab Local Server ({'MOCK' if args.mock else 'GPU'} mode)")
        print(f"  URL:   {url}")
        print(f"  Token: {token}\n")
        if not args.no_browser:
            webbrowser.open(url)
        app = create_app(auth_token=token, mock_mode=args.mock, runs_dir=args.runs_dir)
        uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
