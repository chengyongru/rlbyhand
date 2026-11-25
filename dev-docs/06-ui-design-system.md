# 06 · UI Design System & Bilingual Architecture

## Aesthetic Direction (Anti-AI-Slop Guidelines)

The UI is deliberately modeled after scientific/engineering workbenches (**Distill.pub, Stripe Docs, Observable, Weights & Biases**) rather than generic AI SaaS templates:

- **No neon gradients, glassmorphism, or decorative glows**: Flat surfaces (`shadow: "none"`) with crisp 1px borders (`--lab-border`), subtle warm paper light canvas (`#FAF9F6`) and neutral GitHub-style charcoal dark mode (`#0D1117`).
- **Typography**: `Inter` + native Chinese UI stack (`PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`) for readable prose; `JetBrains Mono` with `font-variant-numeric: tabular-nums` on every metric, slider, reward, and VRAM counter to prevent horizontal jitter during timeline scrubbing.
- **Semantic Color Restraint**:
  - Primary Accent (Active Run / UI): Blueprint Cobalt (`#1D4ED8`)
  - Positive Advantage / Valid / Pass: Forest Emerald (`#059669`)
  - Negative Advantage / Fail / Reward Hack: Crimson (`#DC2626`)
  - Entropy / Warning: Warm Amber (`#D97706`)
  - Reference / Baseline Overlay: Muted Slate (`#94A3B8`, dashed line)
- **Editorial Copy**: Direct, technical, concise phrasing in both Chinese and English; zero hype buzzwords or emojis in controls.

## Reused UI & Visualization Frameworks

| Concern | Package | Usage |
| --- | --- | --- |
| Core Components & Theme | `@mantine/core`, `@mantine/hooks`, `@mantine/notifications` | Layout, Tabs, SegmentedControl, Slider, HoverCard, Modal, Alert, Badges, Light/Dark scheme |
| Resizable Split Workspace | `react-resizable-panels` | Draggable Left Textbook / Right Workbench split persisted in `localStorage` |
| Telemetry Charts | `recharts` | 2×2 synchronized line charts with Baseline dashed overlay & clickable step cursor |
| Code Editor & Diff | `@monaco-editor/react` | Python surgical editor + side-by-side `DiffEditor` |
| Math Rendering | `katex` | Display equations inside `MathBlock.tsx` |
| Icons | `lucide-react` | Minimal 13–17px stroke icons |
| Client State | `zustand` | Single store (`useLabStore.ts`) managing lessons, runs, replay timer, WS state, and i18n |

## Bilingual (`zh` / `en`) Structure

- All UI labels live in `frontend/src/i18n/index.ts` as `{ zh: string; en: string }` objects (`BiText`), selected via `pickText(entry, lang)`.
- All 6 lessons (headings, prose, math captions, callouts, predict-before-run prompts, options, explanations) live in `frontend/src/i18n/lessons.ts` in the same bilingual `BiText` structure.
- Language preference toggles instantaneously via the header `中文 | EN` control and persists in `localStorage` (`llm-rl-lab-lang`).

## Adding a New Lesson or Experiment Preset

1. Add a new `ExperimentPreset` entry in `backend/llm_rl_lab/config.py` and trajectory rules in `backend/llm_rl_lab/demo_data.py`.
2. Regenerate the static bundle: `uv run llm-rl-lab generate-demo --out frontend/src/data/demoRuns.json`.
3. Add the bilingual preset label to `PRESET_LABELS` in `frontend/src/i18n/index.ts` and the lesson entry to `LESSONS` in `frontend/src/i18n/lessons.ts`.
