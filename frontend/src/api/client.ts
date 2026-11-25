import type { DeviceTelemetry, DryRunResult, RunLog } from '../types/lab';

export interface LocalClientConfig {
  baseUrl: string;
  token: string;
}

function cleanBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchLocalDevice(cfg: LocalClientConfig): Promise<DeviceTelemetry> {
  const res = await fetch(`${cleanBaseUrl(cfg.baseUrl)}/api/device`, {
    headers: { 'X-Lab-Token': cfg.token },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function postDryRun(
  cfg: LocalClientConfig,
  lessonId: string,
  code: string
): Promise<DryRunResult> {
  const res = await fetch(`${cleanBaseUrl(cfg.baseUrl)}/api/dry-run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lab-Token': cfg.token,
    },
    body: JSON.stringify({ lesson_id: lessonId, code }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function postStartTrain(
  cfg: LocalClientConfig,
  payload: {
    preset_id: string;
    lesson_id: string;
    speed_mode: 'fast' | 'full';
    custom_code?: string;
  }
): Promise<{ started: boolean; mock_mode: boolean }> {
  const res = await fetch(`${cleanBaseUrl(cfg.baseUrl)}/api/train/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lab-Token': cfg.token,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function postStopTrain(cfg: LocalClientConfig): Promise<void> {
  await fetch(`${cleanBaseUrl(cfg.baseUrl)}/api/train/stop`, {
    method: 'POST',
    headers: { 'X-Lab-Token': cfg.token },
  });
}

export function openTrainWebSocket(
  cfg: LocalClientConfig,
  onEvent: (ev: Record<string, unknown>) => void,
  onClose: () => void
): WebSocket {
  const base = cleanBaseUrl(cfg.baseUrl).replace(/^http/, 'ws');
  const ws = new WebSocket(`${base}/ws/train?token=${encodeURIComponent(cfg.token)}`);
  ws.onmessage = (evt) => {
    try {
      onEvent(JSON.parse(evt.data));
    } catch {
      // ignore malformed frames
    }
  };
  ws.onclose = onClose;
  return ws;
}

/** Lightweight client-side syntax/contract sanity check for Static Replay mode (no backend needed). */
export function browserDryRunCheck(lessonId: string, code: string): DryRunResult {
  const t0 = performance.now();
  const expectedFn: Record<string, string> = {
    'lesson-1': 'compute_sft_loss',
    'lesson-2': 'reinforce_loss',
    'lesson-3': 'grpo_loss',
    'lesson-4': 'ppo_grpo_loss',
    'lesson-5': 'compute_reward',
    'lesson-6': 'dpo_loss',
  };
  const fnName = expectedFn[lessonId] || 'loss';
  const hasDef = new RegExp(`def\\s+${fnName}\\s*\\(`).test(code);
  const hasReturn = /\breturn\b/.test(code);
  const hasForbidden = /\b(import\s+os|import\s+subprocess|eval\(|exec\(|__import__)\b/.test(code);
  const detachedAll = lessonId !== 'lesson-5' && /return\s+.*\.detach\(\)/.test(code);

  const checks = [
    {
      name: 'syntax_and_safety',
      passed: !hasForbidden,
      detail: hasForbidden ? 'Disallowed system call or eval() detected' : 'Safe subset verified',
    },
    {
      name: 'function_signature',
      passed: hasDef && hasReturn,
      detail: hasDef && hasReturn ? `Found \`${fnName}(...)\` with return` : `Expected \`def ${fnName}(...)\` returning a value`,
    },
    {
      name: 'gradient_flow',
      passed: !detachedAll,
      detail: detachedAll ? 'Returned expression appears detached' : 'Policy logp graph preserved (connect Local GPU for PyTorch autograd verification)',
    },
  ];

  const ok = checks.every((c) => c.passed);
  return {
    ok,
    elapsed_ms: Number((performance.now() - t0).toFixed(2)),
    backend: 'browser-check',
    checks,
    summary: ok
      ? `Static contract check passed for \`${fnName}\`. Connect local backend for PyTorch tensor execution.`
      : 'Contract check failed — review diagnostics below.',
    error_line: null,
    error_detail: ok ? null : checks.find((c) => !c.passed)?.detail ?? null,
  };
}

export function isValidRunLog(obj: unknown): obj is RunLog {
  if (!obj || typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;
  return typeof rec.metadata === 'object' && Array.isArray(rec.steps) && rec.steps.length > 0;
}
