# Internal Development Documentation

This directory holds the full architectural, mathematical, engineering, UI, and GPU testing documentation for `llm-rl-lab`. It is intentionally isolated under `dev-docs/` so you can delete the entire folder cleanly (`rm -rf dev-docs`) before making the repository public.

## Document Index

| File | Scope |
| --- | --- |
| [`01-architecture.md`](01-architecture.md) | Dual-mode Local-First Web App architecture, single-package distribution, and localhost security model |
| [`02-data-schema.md`](02-data-schema.md) | Unified `RunLog` / `StepLog` / `SampleRollout` / `TokenProbInfo` JSON schema and WebSocket event contract |
| [`03-curriculum-and-experiments.md`](03-curriculum-and-experiments.md) | 6-lesson syllabus, undergraduate math mapping, Countdown task calibration, and CS 312 predict-before-run ablations |
| [`04-8gb-vram-engineering.md`](04-8gb-vram-engineering.md) | 8 GB VRAM memory ledger, Qwen2.5 151k-vocab logits chunking, `disable_adapter()` reference reuse, and dtype fallback |
| [`05-home-gpu-testing-guide.md`](05-home-gpu-testing-guide.md) | Step-by-step home GPU verification checklist, running `baseline_check.py`, replacing demo logs with real runs, and troubleshooting |
| [`06-ui-design-system.md`](06-ui-design-system.md) | Mantine v7 + Recharts + Monaco + KaTeX UI system, bilingual (`zh`/`en`) structure, and anti-AI-slop visual rules |
