import type { BiText, Lang } from '../types/lab';

export const UI_STRINGS = {
  brandTitle: { zh: 'LLM RL Lab', en: 'LLM RL Lab' },
  brandTag: { zh: '0.5B · 8GB · Countdown', en: '0.5B · 8GB · Countdown' },
  modeReplay: { zh: '在线回放', en: 'Static Replay' },
  modeLocal: { zh: '本地 GPU', en: 'Local GPU' },
  localConnected: { zh: '本地已连接', en: 'Local Connected' },
  localOffline: { zh: '连接本地显卡', en: 'Connect Local GPU' },
  prevLesson: { zh: '上一课', en: 'Previous' },
  nextLesson: { zh: '下一课', en: 'Next' },
  prereqs: { zh: '数学前置', en: 'Math Prereqs' },
  runtime: { zh: '8GB 耗时', en: '8GB Runtime' },

  // Predict card
  predictBadge: { zh: '实验预测 · 先猜再看', en: 'Predict Before You Run' },
  predictLockBtn: { zh: '锁定预测并揭晓曲线', en: 'Lock Prediction & Overlay Curve' },
  predictCorrect: { zh: '符合教学预期', en: 'Matches the lesson’s prediction' },
  predictWrong: { zh: '与教学预期不同', en: 'Differs from the lesson’s prediction' },
  predictReset: { zh: '重新选择', en: 'Try again' },
  predictOverlaid: { zh: '在仪表盘核对记录', en: 'Compare with the logged metrics' },

  // Workbench tabs
  tabDashboard: { zh: '四联仪表盘', en: 'Metrics' },
  tabMicroscope: { zh: '采样显微镜', en: 'Microscope' },
  tabCode: { zh: '代码手术台', en: 'Code Lab' },
  tabConsole: { zh: '显存与日志', en: 'Telemetry' },

  // Controls
  presetLabel: { zh: '实验组', en: 'Experiment' },
  gpuData: { zh: 'GPU 实测', en: 'GPU measurement' },
  mockData: { zh: '模拟数据', en: 'Simulated' },
  unknownSource: { zh: '来源未标明', en: 'Source unspecified' },
  compareBaseline: { zh: '叠加 Baseline', en: 'Overlay Baseline' },
  speedFast: { zh: '快速 (3min)', en: 'Fast (3m)' },
  speedFull: { zh: '完整 (20min)', en: 'Full (20m)' },
  playReplay: { zh: '播放回放', en: 'Play' },
  pauseReplay: { zh: '暂停', en: 'Pause' },
  runGpu: { zh: '本地实跑', en: 'Run Local' },
  stopGpu: { zh: '停止训练', en: 'Stop' },
  stepLabel: { zh: '训练步', en: 'Step' },

  // KPI & Charts
  kpiAcc: { zh: '真实准确率', en: 'True Pass@1' },
  kpiReward: { zh: '组平均奖励', en: 'Mean Reward' },
  kpiLen: { zh: '平均长度', en: 'Avg Tokens' },
  kpiEnt: { zh: '策略熵', en: 'Entropy' },
  kpiKl: { zh: 'KL 散度 (k3)', en: 'KL (k3)' },
  kpiVram: { zh: '峰值显存', en: 'Peak VRAM' },

  chartAccTitle: { zh: '真实准确率 & 观测奖励', en: 'True Accuracy & Observed Reward' },
  chartLenTitle: { zh: '平均回复长度 (tokens)', en: 'Mean Response Length (tokens)' },
  chartEntTitle: { zh: '策略熵 (nats)', en: 'Policy Entropy (nats)' },
  chartKlTitle: { zh: 'KL 散度 (k3) & 截断比例', en: 'KL Divergence (k3) & Clip Fraction' },
  legendActive: { zh: '当前实验', en: 'Active Run' },
  legendBaseline: { zh: '基线', en: 'Baseline' },
  legendReward: { zh: '观测奖励', en: 'Observed Reward' },
  legendClip: { zh: 'Clip 比例', en: 'Clip Fraction' },

  // Microscope
  promptNumbers: { zh: '给定数字', en: 'Numbers' },
  promptTarget: { zh: '目标值', en: 'Target' },
  promptRef: { zh: '参考解', en: 'Reference' },
  groupStats: { zh: '组统计', en: 'Group Stats' },
  zeroGradBanner: {
    zh: '零梯度步 (Zero-Gradient Step)：本组全部样本得分相同（σ = 0），组内标准化后 Advantage 全为 0，这一步不产生策略梯度。',
    en: 'Zero-Gradient Step: all rollouts in this group received identical reward (σ = 0). Normalized advantages are all 0, contributing no gradient.',
  },
  advantagePush: { zh: '拉高概率', en: 'Reinforce' },
  advantagePull: { zh: '压低概率', en: 'Suppress' },
  advantageNeutral: { zh: '零梯度', en: 'No-op' },
  heatmapMode: { zh: 'Token 热力图', en: 'Token Heatmap' },
  heatmapOff: { zh: '关闭', en: 'Off' },
  heatmapProb: { zh: '概率 p', en: 'Prob p' },
  heatmapEntropy: { zh: '熵 H', en: 'Entropy H' },
  heatmapKl: { zh: 'KL 偏移', en: 'KL Drift' },
  topCandidates: { zh: 'Top-5 候选词分布', en: 'Top-5 Token Distribution' },
  hackBadge: { zh: '触发作弊 (Hack)', en: 'REWARD HACK' },
  formatReward: { zh: '格式分', en: 'Format reward' },
  exactMatch: { zh: '数字与结果均对', en: 'Exact Match' },
  numMismatch: { zh: '数字不符', en: 'Wrong Numbers' },

  // Code Lab
  codeModeEdit: { zh: '编辑代码', en: 'Edit' },
  codeModeDiff: { zh: '对比改动', en: 'Diff vs Experiment' },
  dryRunBtn: { zh: '1秒自检 (Dry-Run)', en: 'Dry-Run (1s)' },
  resetCodeBtn: { zh: '重置', en: 'Reset' },
  applyDiffBtn: { zh: '填入实验改动', en: 'Load Ablation Diff' },
  dryRunIdle: {
    zh: '点击 Dry-Run 用迷你张量校验语法、标量输出、NaN 与梯度回传（无需等 GPU 采样）。',
    en: 'Click Dry-Run to validate syntax, scalar shape, NaN safety, and grad_fn on tiny dummy tensors before GPU rollout.',
  },

  // Telemetry & Local Modal
  vramLedgerTitle: { zh: '8 GB 显存预算示例（分项为估算）', en: 'Example 8 GB VRAM Budget (estimated breakdown)' },
  vramBase: { zh: '基座 (bf16)', en: 'Base (bf16)' },
  vramLora: { zh: 'LoRA + 优化器', en: 'LoRA + AdamW' },
  vramRef: { zh: 'Ref 模型 (复用)', en: 'Ref (Shared)' },
  vramAct: { zh: '激活值 (微批)', en: 'Activations (MB=2)' },
  vramSys: { zh: 'CUDA + 浏览器', en: 'CUDA + Browser' },
  exportJson: { zh: '导出当前 Run JSON', en: 'Export Run JSON' },
  importJson: { zh: '导入本地 GPU JSON', en: 'Import GPU Run JSON' },
  consoleTitle: { zh: '运行日志', en: 'Execution Log' },

  modalTitle: { zh: '连接本地 8GB 显卡后端', en: 'Connect Local 8 GB GPU Backend' },
  modalDesc: {
    zh: '网页前端本身不直接访问本地 GPU。在终端运行一条命令启动本地 FastAPI + PyTorch 服务，仅监听 127.0.0.1 并受随机 Token 保护。',
    en: 'Browsers cannot run PyTorch backprop directly. Start the local FastAPI + PyTorch server bound strictly to 127.0.0.1 with a per-session token.',
  },
  modalServerUrl: { zh: '本地服务地址', en: 'Local Server URL' },
  modalToken: { zh: '会话 Token（终端启动时打印）', en: 'Session Token (printed on startup)' },
  modalConnectBtn: { zh: '验证并连接', en: 'Verify & Connect' },
  modalDisconnectBtn: { zh: '断开并切回在线回放', en: 'Disconnect (Back to Replay)' },
} as const;

export const PRESET_LABELS: Record<string, BiText> = {
  sft_probe: { zh: 'L1 · 概率探针 (无 RL 更新)', en: 'L1 · Probability Probe (No RL)' },
  reinforce_basic: { zh: 'L2 · 极简 REINFORCE', en: 'L2 · Vanilla REINFORCE' },
  no_format_reward: { zh: 'L2 对照 · 删除格式分 (0/1 稀疏奖励)', en: 'L2 Ablation · No Format Reward (0/1)' },
  baseline_grpo: { zh: 'L3 · 标准 GRPO (Baseline)', en: 'L3 · Standard GRPO (Baseline)' },
  reward_shift_plus10: { zh: 'L3 对照 · 奖励全员 +10 (无 Baseline)', en: 'L3 Ablation · Reward +10 (No Baseline)' },
  ppo_multi_epoch: { zh: 'L4 · 多轮更新 PPO-GRPO (4 epochs)', en: 'L4 · Multi-Epoch PPO-GRPO (4 epochs)' },
  kl_zero_collapse: { zh: 'L4 对照 · 删去 KL 与 Clip (β=0)', en: 'L4 Ablation · No KL & No Clip (β=0)' },
  reward_hacking: { zh: 'L5 对照 · 注释数字校验 (Reward Hacking)', en: 'L5 Ablation · Skip Number Check (Hack)' },
  entropy_collapse: { zh: 'L5 对照 · 低温采样 (熵坍塌)', en: 'L5 Ablation · Low Temp (Entropy Collapse)' },
  offline_dpo: { zh: 'L6 · 离线 DPO (同源 Countdown 样本对)', en: 'L6 · Offline DPO (Countdown Pairs)' },
};

export function pickText(text: BiText, lang: Lang): string {
  return text[lang];
}
