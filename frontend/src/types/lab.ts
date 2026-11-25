export type Lang = 'zh' | 'en';

export interface BiText {
  zh: string;
  en: string;
}

export interface TokenCandidate {
  token: string;
  prob: number;
}

export interface TokenProbInfo {
  token: string;
  prob: number;
  log_prob: number;
  entropy: number;
  kl: number;
  advantage: number;
  top_candidates: TokenCandidate[];
}

export interface RewardBreakdown {
  format_reward: number;
  correct_reward: number;
  total_reward: number;
  has_think_tags: boolean;
  has_answer_tags: boolean;
  extracted_expr: string | null;
  evaluated_value: number | null;
  numbers_valid: boolean;
  target_matched: boolean;
  hack_detected: boolean;
  reason: string;
}

export interface SampleRollout {
  index: number;
  raw_text: string;
  think_text: string;
  answer_text: string;
  num_tokens: number;
  mean_log_prob: number;
  reward: number;
  advantage: number;
  breakdown: RewardBreakdown;
  token_probs?: TokenProbInfo[];
}

export interface StepMetrics {
  step: number;
  accuracy: number;
  mean_reward: number;
  reward_std: number;
  mean_response_length: number;
  entropy: number;
  kl_divergence: number;
  clip_fraction: number;
  loss: number;
  grad_norm: number;
  zero_grad_step: boolean;
  vram_allocated_gb: number;
  vram_peak_gb: number;
  step_time_sec: number;
}

export interface StepLog {
  step: number;
  prompt_numbers: number[];
  prompt_target: number;
  prompt_solution: string;
  metrics: StepMetrics;
  group_mean_reward: number;
  group_std_reward: number;
  zero_grad_group: boolean;
  samples: SampleRollout[];
}

export interface RunMetadata {
  run_id: string;
  preset_id: string;
  lesson_id: string;
  algorithm: 'sft_probe' | 'reinforce' | 'grpo' | 'ppo_grpo' | 'dpo';
  model_name: string;
  dtype: string;
  lora_rank: number;
  group_size: number;
  max_new_tokens: number;
  kl_beta: number;
  clip_eps: number;
  update_epochs: number;
  learning_rate: number;
  use_format_reward: boolean;
  check_numbers_exact: boolean;
  reward_shift: number;
  use_baseline: boolean;
  is_mock: boolean;
  created_at: string;
}

export interface RunLog {
  schema_version: string;
  metadata: RunMetadata;
  steps: StepLog[];
}

export interface DryRunCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DryRunResult {
  ok: boolean;
  elapsed_ms: number;
  backend: 'torch' | 'numpy-shim' | 'browser-check';
  checks: DryRunCheck[];
  summary: string;
  error_line: number | null;
  error_detail: string | null;
}

export interface DeviceTelemetry {
  device_type: 'cuda' | 'mps' | 'cpu';
  device_name: string;
  recommended_dtype: string;
  total_vram_gb: number;
  allocated_vram_gb: number;
  reserved_vram_gb: number;
  torch_available: boolean;
  transformers_available: boolean;
  peft_available: boolean;
  hf_endpoint: string;
  mock_mode: boolean;
}

export interface LessonSection {
  heading: BiText;
  paragraphs: BiText[];
  formula?: string;
  formulaCaption?: BiText;
  callout?: {
    kind: 'math' | 'vram' | 'warn';
    title: BiText;
    body: BiText;
  };
}

export interface PredictOption {
  id: string;
  label: BiText;
}

export interface PredictChallenge {
  title: BiText;
  prompt: BiText;
  diffLines: { type: 'ctx' | 'del' | 'add'; text: string }[];
  options: PredictOption[];
  correctOptionId: string;
  explanation: BiText;
  experimentPresetId: string;
  baselinePresetId: string;
}

export interface LessonDefinition {
  id: string;
  number: string;
  shortTitle: BiText;
  title: BiText;
  subtitle: BiText;
  mathPrereqs: BiText[];
  estimatedTime: BiText;
  defaultPresetId: string;
  baselinePresetId: string;
  availablePresets: string[];
  sections: LessonSection[];
  predict: PredictChallenge;
  starterCode: string;
  experimentDiffCode: string;
  codeFileName: string;
}

export interface ConsoleEntry {
  id: string;
  ts: string;
  level: 'info' | 'warn' | 'error' | 'ok';
  message: string;
}
