"""Tests for FastAPI endpoints, token auth, and mock WebSocket streaming."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from llm_rl_lab.server import create_app


def test_health_and_token_auth(tmp_path: Path):
    app = create_app(auth_token="secret-test-token", mock_mode=True, runs_dir=tmp_path)
    client = TestClient(app)

    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/device").status_code == 401
    assert client.get("/api/device", headers={"X-Lab-Token": "wrong"}).status_code == 401

    resp = client.get("/api/device", headers={"X-Lab-Token": "secret-test-token"})
    assert resp.status_code == 200
    assert resp.json()["mock_mode"] is True


def test_dry_run_endpoint_and_websocket(tmp_path: Path):
    app = create_app(auth_token="tok-123", mock_mode=True, runs_dir=tmp_path)
    client = TestClient(app)

    resp = client.post(
        "/api/dry-run",
        headers={"X-Lab-Token": "tok-123"},
        json={
            "lesson_id": "lesson-1",
            "code": "def compute_sft_loss(per_token_logp, mask):\n    return -(per_token_logp * mask).sum() / mask.sum()",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    with client.websocket_connect("/ws/train?token=tok-123") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connected"
        assert msg["device"]["mock_mode"] is True
