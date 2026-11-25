import type { LessonDefinition } from '../types/lab';

export const LESSONS: LessonDefinition[] = [
  {
    id: 'lesson-1',
    number: '01',
    shortTitle: { zh: '概率分布与 SFT', en: 'LLM as Distribution' },
    title: {
      zh: '把大语言模型看作条件概率分布',
      en: 'Treating an LLM as a Conditional Distribution',
    },
    subtitle: {
      zh: '从条件概率连乘和负对数似然出发，看清 SFT 在做什么，以及它为什么解不了需要试错的问题。',
      en: 'Start from chain-rule probabilities and negative log-likelihood: what SFT actually updates, and why imitation stalls on search problems.',
    },
    mathPrereqs: [
      { zh: '概率论：条件概率连乘', en: 'Probability: Chain Rule' },
      { zh: '微积分：对数与最大似然', en: 'Calculus: Log-Likelihood' },
    ],
    estimatedTime: { zh: '~1 min', en: '~1 min' },
    defaultPresetId: 'sft_probe',
    baselinePresetId: 'baseline_grpo',
    availablePresets: ['sft_probe', 'baseline_grpo'],
    sections: [
      {
        heading: { zh: '1. 自回归生成就是一串条件概率', en: '1. Autoregressive Generation Is Just the Chain Rule' },
        paragraphs: [
          {
            zh: '给模型一个提示词 x（例如 Countdown 题目 [3, 7, 12] -> 33），模型逐个词元（token）生成完整回复 y = (y_1, ..., y_T)。每一步，网络输出词表大小的 logits 向量，经 Softmax 变成下一个词元的概率分布。',
            en: 'Given a prompt x (such as Countdown [3, 7, 12] -> 33), the model emits tokens y = (y_1, ..., y_T) one by one. At each position t, logits pass through Softmax to define a categorical distribution over the vocabulary.',
          },
          {
            zh: '整条回复的联合概率是各步条件概率的连乘；取对数后，连乘变成求和，既防止下溢，又让梯度变成简单的逐词元累加。',
            en: 'The sequence probability is the product of per-step conditionals. Taking the log turns products into sums—avoiding numerical underflow and making gradients additive across tokens.',
          },
        ],
        formula: String.raw`\log \pi_\theta(y \mid x) = \sum_{t=1}^{T} \log \pi_\theta(y_t \mid x, y_{<t})`,
        formulaCaption: {
          zh: '若日志记录了逐词概率，可在“采样显微镜”打开热力图，悬浮词元查看概率 p、局部熵 H 与 Top-5 候选词。',
          en: 'If token probabilities were logged, enable the heatmap in the Microscope and hover a token to inspect its probability p, local entropy H, and Top-5 candidates.',
        },
      },
      {
        heading: { zh: '2. SFT 的局限：只拉高标准答案', en: '2. What SFT Does—and Where It Stops' },
        paragraphs: [
          {
            zh: '监督微调（SFT）最小化标准答案的负对数似然（Cross-Entropy）。它要求人类或更强模型提前写出每一步推理过程，并且只告诉模型“模仿这一条路径”，从不让模型在自己犯错的分布上试错。',
            en: 'Supervised Fine-Tuning (SFT) minimizes negative log-likelihood on fixed demonstrations. It requires pre-written reference traces and never lets the model sample its own trajectories or learn from its own mistakes.',
          },
          {
            zh: '假设在 3 数字 Countdown 上，模型的 Pass@1 只有 16%，但 Pass@6 超过 50%：这意味着正确解法已在采样分布里，训练可以尝试提高这些样本的概率。',
            en: 'Suppose Pass@1 is only 16% on 3-number Countdown but Pass@6 exceeds 50%. Valid solutions are already in the sampling distribution; training can try to make them more likely.',
          },
        ],
        formula: String.raw`\mathcal{L}_{\text{SFT}}(\theta) = -\frac{1}{T}\sum_{t=1}^{T} \log \pi_\theta(y_t^* \mid x, y_{<t}^*)`,
        callout: {
          kind: 'vram',
          title: { zh: '8GB 显存工程注记：词表 logits 峰值', en: '8 GB VRAM Note: The Vocab Logits Spike' },
          body: {
            zh: 'Qwen2.5 词表高达 151,936。若一次性把整批 [B*G, L, 151936] 转成 fp32 算 log_softmax，单张张量就会吃掉 >1.2 GB。本课程后端默认按 64 个 token 分块计算，并用微批（micro-batch=2）累加梯度，把总峰值压在 5.5 GB 以内。',
            en: 'Qwen2.5 has a 151,936-token vocabulary. Casting a full [B*G, L, 151936] logits tensor to fp32 spikes over 1.2 GB by itself. Our backend chunks log_softmax along sequence length (64 tokens) and accumulates micro-batches of 2 sequences to keep peak VRAM under 5.5 GB.',
          },
        },
      },
    ],
    predict: {
      title: { zh: '热身预测：0.5B 模型在 Countdown 上的冷启动', en: 'Warm-up Prediction: 0.5B Cold Start on Countdown' },
      prompt: {
        zh: '保持 Qwen2.5-0.5B-Instruct 权重冻结，只用规则验证器检查 3 数字 Countdown。与开启 GRPO 训练 150 步相比，单纯提高采样数（Pass@6）与训练后的单次命中率（Pass@1）会怎么变化？',
        en: 'Keep Qwen2.5-0.5B-Instruct frozen on 3-number Countdown versus training it for 150 GRPO steps. How does Pass@1 behave without RL updates compared to GRPO?',
      },
      diffLines: [
        { type: 'ctx', text: '# Lesson 1 vs Lesson 3 (150 steps on 3-number Countdown)' },
        { type: 'del', text: '- optimizer.step()  # Frozen probe: no parameter updates' },
        { type: 'add', text: '+ loss = grpo_loss(logp, old_logp, ref_logp, mask, rewards)' },
        { type: 'add', text: '+ loss.backward(); optimizer.step()' },
      ],
      options: [
        { id: 'a', label: { zh: '0.5B 太小，开不开 GRPO 正确率都卡在 15% 左右', en: '0.5B is too small; Pass@1 stays around 15% even with GRPO' } },
        { id: 'b', label: { zh: '冻结模型停在 ~16%，GRPO 能把已有采样能力蒸馏到 Pass@1（>60%）', en: 'Frozen stays near ~16%; GRPO sharpens existing Pass@6 hits into >60% Pass@1' } },
        { id: 'c', label: { zh: 'GRPO 会把策略熵拉高到 2.0 以上以增加探索', en: 'GRPO pushes policy entropy above 2.0 to explore more broadly' } },
      ],
      correctOptionId: 'b',
      explanation: {
        zh: 'RLVR 在小模型上的核心效应是“把多次采样偶尔碰对的路径，转化为单次采样稳定输出的能力”：Pass@1 从 ~16% 爬升至 ~68%，同时策略熵随收敛逐步下降。',
        en: 'On a 0.5B model, RLVR converts occasional multi-sample hits into reliable single-shot accuracy: Pass@1 climbs from ~16% to ~68% while policy entropy steadily narrows.',
      },
      experimentPresetId: 'baseline_grpo',
      baselinePresetId: 'sft_probe',
    },
    codeFileName: 'lesson01_sft_loss.py',
    starterCode: `def compute_sft_loss(per_token_logp, mask):
    """Mean negative log-likelihood over response tokens.

    Args:
        per_token_logp: [G, L] log pi_theta(y_t | x, y_<t)
        mask:           [G, L] 1 for response tokens, 0 for padding
    """
    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    nll_per_seq = -(per_token_logp * mask).sum(dim=-1) / seq_lens
    return nll_per_seq.mean()
`,
    experimentDiffCode: `def compute_sft_loss(per_token_logp, mask):
    """Token-weighted average (no per-sequence length division)."""
    total_tokens = mask.sum().clamp(min=1.0)
    return -(per_token_logp * mask).sum() / total_tokens
`,
  },

  {
    id: 'lesson-2',
    number: '02',
    shortTitle: { zh: 'REINFORCE 闭环', en: 'REINFORCE Loop' },
    title: {
      zh: '从加权 SFT 到 REINFORCE 策略梯度',
      en: 'From Weighted SFT to REINFORCE Policy Gradients',
    },
    subtitle: {
      zh: '只需大一微积分的对数求导恒等式，把不可微的“采样 + 规则打分”变成可直接反向传播的损失函数。',
      en: 'One calculus identity—the log-derivative trick—turns non-differentiable text sampling and rule scoring into standard backprop.',
    },
    mathPrereqs: [
      { zh: '高数：对数求导 (ln f)\' = f\'/f', en: 'Calculus: (ln f)\' = f\'/f' },
      { zh: '概统：蒙特卡洛期望估计', en: 'Probability: Monte Carlo Expectation' },
    ],
    estimatedTime: { zh: '~10 min (8GB)', en: '~10 min (8GB)' },
    defaultPresetId: 'reinforce_basic',
    baselinePresetId: 'baseline_grpo',
    availablePresets: ['reinforce_basic', 'no_format_reward', 'baseline_grpo'],
    sections: [
      {
        heading: { zh: '1. 对数求导技巧（Log-Derivative Trick）', en: '1. The Log-Derivative Trick' },
        paragraphs: [
          {
            zh: '我们的目标是最大化期望奖励 J(θ) = E_{y ~ π_θ}[R(y)]。采样操作本身离散不可微，但把期望写成求和后利用 ∇π = π · ∇log π，梯度就重新变回了关于当前策略的期望：',
            en: 'We want to maximize expected reward J(θ) = E_{y ~ π_θ}[R(y)]. Sampling discrete tokens is non-differentiable, but rewriting ∇π = π · ∇log π turns the gradient back into an expectation under π_θ:',
          },
        ],
        formula: String.raw`\nabla_\theta \mathbb{E}_{y \sim \pi_\theta}[R(y)] = \mathbb{E}_{y \sim \pi_\theta}\!\left[R(y)\,\nabla_\theta \log \pi_\theta(y \mid x)\right]`,
        formulaCaption: {
          zh: '工程上只需把标量奖励 R(y) 乘到负对数似然前面（记得 detach 掉 R），再调用一次 loss.backward()。本质上就是按得分加权的 SFT。',
          en: 'In PyTorch, multiply the detached scalar R(y) by the negative log-prob and call backward(). Structurally, it is just reward-weighted SFT.',
        },
      },
      {
        heading: { zh: '2. 两段式规则奖励与冷启动稀疏性', en: '2. Two-Stage Rule Rewards vs. Sparse 0/1' },
        paragraphs: [
          {
            zh: 'Countdown 验证器不需要任何 Reward Model：用 Python AST 解析 <answer> 里的算式，完全避免 eval() 风险。标准配置给予 +0.1 格式分和 +1.0 正确分。',
            en: 'The Countdown verifier needs no neural reward model: a 20-line Python AST evaluator parses <answer> safely (never eval()). Default scoring awards +0.1 for valid tags/syntax and +1.0 for an exact solution.',
          },
          {
            zh: '对 0.5B 小模型而言，+0.1 的格式分不是锦上添花——它决定了早期多少步能拿到非零梯度。',
            en: 'For a 0.5B model, that +0.1 format signal is not cosmetic—it governs how quickly the policy escapes early cold-start plateaus.',
          },
        ],
        callout: {
          kind: 'math',
          title: { zh: '直觉检查', en: 'Sanity Check' },
          body: {
            zh: '当 R(y) 只能取 0 或 1 时，所有答错的样本权重都是 0，梯度完全消失；只有极少数碰对的样本在拉参数。',
            en: 'With pure 0/1 rewards, every wrong rollout gets weight 0 and contributes zero gradient; updates rely entirely on rare lucky hits.',
          },
        },
      },
    ],
    predict: {
      title: { zh: '对照实验 1：删掉 +0.1 格式分', en: 'Ablation 1: Removing the +0.1 Format Reward' },
      prompt: {
        zh: '如果把验证器里的 format_reward 从 0.1 改为 0.0（纯 0/1 稀疏奖励），前 60 步的正确率曲线会怎么表现？',
        en: 'If we set format_reward = 0.0 (strict 0/1 sparse reward), what happens to accuracy over the first 60 steps?',
      },
      diffLines: [
        { type: 'ctx', text: 'def verify_countdown(completion, numbers, target):' },
        { type: 'del', text: '-   format_reward = 0.1 if (has_think and has_answer) else 0.0' },
        { type: 'add', text: '+   format_reward = 0.0  # Pure sparse 0/1 reward' },
        { type: 'ctx', text: '    correct_reward = 1.0 if (numbers_valid and target_matched) else 0.0' },
      ],
      options: [
        { id: 'a', label: { zh: '学得更快，因为模型不再分心去赚 0.1 的格式分', en: 'Learns faster because the model stops chasing the 0.1 format bonus' } },
        { id: 'b', label: { zh: '前期出现明显冷启动平台期，格式输出不稳定，爬升大幅滞后', en: 'Long cold-start plateau with erratic tag formatting and much slower climb' } },
        { id: 'c', label: { zh: '两者曲线几乎重合', en: 'Both curves are nearly identical' } },
      ],
      correctOptionId: 'b',
      explanation: {
        zh: '0.5B 模型早期常漏写闭合标签导致表达式无法提取。去掉 +0.1 格式引导后，约前 45% 的训练步都在冷启动平台上打转，直到偶尔凑齐“格式对且算对”的样本才开始缓慢爬升。',
        en: 'Early on, a 0.5B model frequently drops closing tags so answers cannot be parsed. Without the +0.1 shaping signal, training stalls for nearly half the run before sparse hits accumulate.',
      },
      experimentPresetId: 'no_format_reward',
      baselinePresetId: 'reinforce_basic',
    },
    codeFileName: 'lesson02_reinforce.py',
    starterCode: `def reinforce_loss(per_token_logp, mask, rewards):
    """Minimal REINFORCE policy gradient loss (no baseline).

    Args:
        per_token_logp: [G, L]
        mask:           [G, L]
        rewards:        [G]
    """
    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    seq_logp = (per_token_logp * mask).sum(dim=-1) / seq_lens
    return -(rewards.detach() * seq_logp).mean()
`,
    experimentDiffCode: `def reinforce_loss(per_token_logp, mask, rewards):
    """REINFORCE with simple group-mean baseline to cut variance."""
    advantages = (rewards - rewards.mean()).detach()
    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    seq_logp = (per_token_logp * mask).sum(dim=-1) / seq_lens
    return -(advantages * seq_logp).mean()
`,
  },

  {
    id: 'lesson-3',
    number: '03',
    shortTitle: { zh: '方差与 GRPO', en: 'Variance & GRPO' },
    title: {
      zh: '方差的诅咒与 GRPO 组内相对优势',
      en: 'The Curse of Variance and GRPO Group Normalization',
    },
    subtitle: {
      zh: '为什么一个不改变数学期望的常数偏移能让训练彻底崩盘？用高中 Z-score 替代整个 Critic 网络。',
      en: 'Why adding a constant to rewards preserves exact mathematical expectation yet destroys finite-sample training—and how Z-score normalization replaces the Critic.',
    },
    mathPrereqs: [
      { zh: '概统：期望线性性与方差', en: 'Probability: Mean & Variance' },
      { zh: '统计：Z-score 标准化', en: 'Statistics: Z-score Normalization' },
    ],
    estimatedTime: { zh: '~15 min (8GB)', en: '~15 min (8GB)' },
    defaultPresetId: 'baseline_grpo',
    baselinePresetId: 'reinforce_basic',
    availablePresets: ['baseline_grpo', 'reward_shift_plus10', 'reinforce_basic'],
    sections: [
      {
        heading: { zh: '1. 常数 Baseline 的神奇性质', en: '1. Why Subtracting a Baseline Is Unbiased' },
        paragraphs: [
          {
            zh: '对任意不依赖输出 y 的常数 b，容易验证 E[b · ∇log π(y|x)] = b · ∇∑π(y|x) = b · ∇1 = 0。因此把 R(y) 换成 R(y) - b 在无限样本下完全不改变梯度的数学期望。',
            en: 'For any baseline b independent of y, E[b · ∇log π(y|x)] = b · ∇∑π(y|x) = b · ∇1 = 0. Subtracting b never biases the true expected gradient.',
          },
          {
            zh: '但在有限样本（比如每题只采 G=6 条）下，若所有奖励都为正数，答错的样本也会被分配正权重，梯度方差会剧烈放大，参数被噪声拉爆。',
            en: 'With finite samples (G=6 rollouts per prompt), keeping all rewards strictly positive assigns positive gradient push even to wrong answers, inflating variance until optimization diverges.',
          },
        ],
        formula: String.raw`A_i = \frac{R_i - \mu_{\text{group}}}{\sigma_{\text{group}} + \varepsilon}, \quad \mu_{\text{group}} = \frac{1}{G}\sum_{j=1}^{G} R_j`,
        formulaCaption: {
          zh: 'GRPO 的核心：对同一道题采样 G 条回答，用组内均值当 Baseline、组内标准差做归一化——高分变正（拉高），低分变负（压低），彻底省掉传统 PPO 的 Critic 网络。',
          en: 'GRPO samples G rollouts per prompt and Z-normalizes their rewards: above-average answers turn positive (reinforced), below-average turn negative (suppressed)—eliminating the Critic model entirely.',
        },
      },
      {
        heading: { zh: '2. 警惕“零梯度步（Zero-Gradient Step）”', en: '2. Watching Out for Zero-Gradient Steps' },
        paragraphs: [
          {
            zh: '当某道题太难（G 条全错，R 全为 0.1）或太简单（G 条全对，R 全为 1.1）时，组内标准差 σ = 0，所有 Advantage 全是 0，这一步白算。拖动步数滑块，查看显微镜中是否有标记为零梯度的采样组。',
            en: 'When a prompt is too hard (all G fail) or too easy (all G pass), σ = 0 and every advantage collapses to 0—a wasted step. Use the step slider to check whether any groups are marked as zero-gradient in the Microscope.',
          },
        ],
        callout: {
          kind: 'vram',
          title: { zh: '8GB 显存关键技巧：LoRA 零成本 Reference Model', en: '8 GB VRAM Trick: Zero-Cost Reference via LoRA' },
          body: {
            zh: 'GRPO 只需要 1 个 0.5B 基座 + LoRA 旁路。需要算 Reference Model 概率时，用 `with model.disable_adapter():` 临时关掉 LoRA 即可，Reference 额外显存占用直接归零。',
            en: 'With LoRA on a frozen 0.5B base, computing reference log-probs requires no second model copy: wrap the forward pass in `with model.disable_adapter():` for 0 GB extra VRAM.',
          },
        },
      },
    ],
    predict: {
      title: { zh: '对照实验 2：把 REINFORCE 所有奖励统一 +10', en: 'Ablation 2: Shifting All Rewards by +10 (No Baseline)' },
      prompt: {
        zh: '在没有 Baseline 的 REINFORCE 中，把每条样本的奖励从 {0, 0.1, 1.1} 统一加上常数 10.0（变成 {10, 10.1, 11.1}）。既然数学期望不变，训练曲线会怎样？',
        en: 'In vanilla REINFORCE without a baseline, add +10.0 to every reward (moving them from {0, 0.1, 1.1} to {10, 10.1, 11.1}). Since the analytical expectation is unchanged, what happens?',
      },
      diffLines: [
        { type: 'ctx', text: 'rewards = compute_group_rewards(samples)' },
        { type: 'del', text: '- advantages = (rewards - rewards.mean()) / (rewards.std() + 1e-6)' },
        { type: 'add', text: '+ advantages = rewards + 10.0  # Constant shift, no baseline!' },
      ],
      options: [
        { id: 'a', label: { zh: '因为期望不变，训练曲线基本不受影响', en: 'Expectation is unchanged, so the training curve barely moves' } },
        { id: 'b', label: { zh: '收敛变慢一点，但最终仍能涨到 50%+', en: 'Slightly noisier, but still climbs past 50% accuracy' } },
        { id: 'c', label: { zh: '错答案也被施以 +10 的正向拉升，方差爆炸，准确率直接坍塌', en: 'Wrong samples get a +10 positive push; variance explodes and accuracy collapses' } },
      ],
      correctOptionId: 'c',
      explanation: {
        zh: '答错（10.1）和答对（11.1）的相对差距被稀释到不足 10%，且全部是正向更新。有限采样下，模型把大量错误回答与重复模板一并强化，KL 飙升、准确率迅速跌穿初始值。',
        en: 'Wrong (10.1) and right (11.1) rollouts both receive huge positive pushes with less than 10% relative contrast. Under finite G=6 sampling, noise overwhelms signal, KL spikes, and accuracy collapses.',
      },
      experimentPresetId: 'reward_shift_plus10',
      baselinePresetId: 'baseline_grpo',
    },
    codeFileName: 'lesson03_grpo.py',
    starterCode: `def grpo_loss(per_token_logp, ref_logp, mask, rewards, kl_beta=0.04):
    """On-policy GRPO loss with Z-score group advantages and Schulman k3 KL."""
    mean_r = rewards.mean()
    std_r = rewards.std(unbiased=False)
    adv = ((rewards - mean_r) / (std_r + 1e-6)).detach().unsqueeze(-1)

    # Schulman k3 unbiased non-negative KL: r - log(r) - 1
    log_r = (ref_logp.detach() - per_token_logp).clamp(-20.0, 20.0)
    kl_per_tok = torch.exp(log_r) - log_r - 1.0

    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    per_seq = ((-per_token_logp * adv + kl_beta * kl_per_tok) * mask).sum(dim=-1) / seq_lens
    return per_seq.mean()
`,
    experimentDiffCode: `def grpo_loss(per_token_logp, ref_logp, mask, rewards, kl_beta=0.04):
    """Dr. GRPO variant: remove std division and per-sequence length bias."""
    adv = (rewards - rewards.mean()).detach().unsqueeze(-1)
    log_r = (ref_logp.detach() - per_token_logp).clamp(-20.0, 20.0)
    kl_per_tok = torch.exp(log_r) - log_r - 1.0
    total_tokens = mask.sum().clamp(min=1.0)
    return ((-per_token_logp * adv + kl_beta * kl_per_tok) * mask).sum() / total_tokens
`,
  },

  {
    id: 'lesson-4',
    number: '04',
    shortTitle: { zh: 'Clipping 与 KL', en: 'Clipping & KL' },
    title: {
      zh: '重要性采样、PPO 截断与 Schulman k3 KL',
      en: 'Importance Sampling, PPO Clipping, and Schulman k3 KL',
    },
    subtitle: {
      zh: '在 8GB 显卡上采样最耗时，想把同一批样本多更新几次（update_epochs = 4），为什么必须上双保险？',
      en: 'Rollout is the bottleneck on an 8 GB GPU. Reusing each batch for 4 gradient updates speeds learning—but only with clipping and k3 KL guards.',
    },
    mathPrereqs: [
      { zh: '概统：重要性采样 (IS)', en: 'Probability: Importance Sampling' },
      { zh: '高数：e^x - x - 1 >= 0', en: 'Calculus: e^x - x - 1 >= 0' },
    ],
    estimatedTime: { zh: '~15 min (8GB)', en: '~15 min (8GB)' },
    defaultPresetId: 'ppo_multi_epoch',
    baselinePresetId: 'baseline_grpo',
    availablePresets: ['ppo_multi_epoch', 'kl_zero_collapse', 'baseline_grpo'],
    sections: [
      {
        heading: { zh: '1. 复用旧样本：重要性比率与 Clipping', en: '1. Reusing Rollouts: Ratio & Clipping' },
        paragraphs: [
          {
            zh: '单步更新（update_epochs = 1）时，新旧策略完全一致，比率 ρ = π_θ / π_old 恒等于 1，Clipping 根本不会触发。一旦把同一批采样反复更新 4 次，第 2~4 次更新时模型已经偏离采样分布，必须乘以重要性采样比率 ρ 并截断在 [1 - ε, 1 + ε]。',
            en: 'With update_epochs = 1, the ratio ρ = π_θ / π_old is identically 1 and clipping never fires. Once you reuse a batch for 4 epochs, subsequent updates are off-policy—requiring importance ratios clipped to [1 - ε, 1 + ε].',
          },
          {
            zh: '观察仪表盘第四张图里的 Clip 比例（clip_fraction）：大约 5%~15% 是健康区间，说明既充分利用了旧样本，又及时按住了步幅过大的 token。',
            en: 'Watch clip_fraction in the fourth dashboard panel: 5%–15% indicates healthy multi-epoch reuse where overly aggressive token updates are caught.',
          },
        ],
        formula: String.raw`\mathcal{L}_{\text{clip}} = -\min\!\Big(\rho_t A,\; \operatorname{clip}(\rho_t, 1-\varepsilon, 1+\varepsilon) A\Big), \quad \rho_t = \frac{\pi_\theta(y_t \mid x, y_{<t})}{\pi_{\text{old}}(y_t \mid x, y_{<t})}`,
      },
      {
        heading: { zh: '2. 为什么用 Schulman k3 而不是 log π - log π_ref？', en: '2. Why Schulman k3 Instead of log π - log π_ref?' },
        paragraphs: [
          {
            zh: '单样本直接算 log(π_θ / π_ref) 经常出现负值且方差极大。GRPO 采用 k3 估计器 r - log r - 1（其中 r = π_ref / π_θ）：由高数基本不等式 e^u - u - 1 ≥ 0 可知它逐 token 严格非负，且期望严格等于 KL(π_θ || π_ref)。',
            en: 'The naive estimator log(π_θ / π_ref) can be negative on individual samples and suffers high variance. GRPO uses Schulman\'s k3 estimator r - log r - 1 (with r = π_ref / π_θ): by e^u - u - 1 >= 0, it is strictly non-negative per token and unbiased.',
          },
        ],
        formula: String.raw`\widehat{D}_{\text{KL}}^{(k3)}(\pi_\theta \,\|\, \pi_{\text{ref}}) = \frac{\pi_{\text{ref}}}{\pi_\theta} - \log \frac{\pi_{\text{ref}}}{\pi_\theta} - 1 \;\ge\; 0`,
      },
    ],
    predict: {
      title: { zh: '对照实验 3：多轮更新时去掉 Clip 和 KL (β = 0)', en: 'Ablation 3: Multi-Epoch Updates Without Clip & KL (β = 0)' },
      prompt: {
        zh: '保持 update_epochs = 4，但把 KL 系数 β 设为 0、同时放开 Clipping 截断。准确率会比标准 PPO-GRPO 更高，还是先涨后崩？',
        en: 'Keep update_epochs = 4, but set kl_beta = 0.0 and disable clipping. Does accuracy climb higher without constraints, or spike and collapse?',
      },
      diffLines: [
        { type: 'ctx', text: 'update_epochs = 4' },
        { type: 'del', text: '- clip_eps = 0.2; kl_beta = 0.04' },
        { type: 'add', text: '+ clip_eps = 10.0; kl_beta = 0.0  # Unconstrained off-policy updates' },
      ],
      options: [
        { id: 'a', label: { zh: '没有 KL 束缚，模型自由发挥，准确率一路飙升到 80%+', en: 'Freed from KL constraints, accuracy climbs past 80%' } },
        { id: 'b', label: { zh: '前 40 步涨得很快，随后 KL 指数爆炸，输出退化成乱码并彻底崩溃', en: 'Spikes fast for ~40 steps, then KL explodes and outputs degenerate into gibberish' } },
        { id: 'c', label: { zh: '训练立刻报 NaN，第 1 步就停住', en: 'Immediately hits NaN on step 1' } },
      ],
      correctOptionId: 'b',
      explanation: {
        zh: '无约束的多轮更新在前 ~45 步看似更猛，但一旦某些高优势词元的概率比率被反复推大，策略迅速漂移出语言模型流形：KL 冲破 1.0，长度暴涨到上限，显微镜里开始刷出重复符号乱码。',
        en: 'Unconstrained multi-epoch updates look faster for ~45 steps, then runaway importance ratios push the policy off the natural-language manifold: KL shoots past 1.0, length maxes out, and rollouts dissolve into repetitive gibberish.',
      },
      experimentPresetId: 'kl_zero_collapse',
      baselinePresetId: 'ppo_multi_epoch',
    },
    codeFileName: 'lesson04_ppo_kl.py',
    starterCode: `def ppo_grpo_loss(logp, old_logp, ref_logp, mask, rewards, clip_eps=0.2, kl_beta=0.04):
    """Clipped PPO-GRPO objective with Schulman k3 KL penalty."""
    adv = ((rewards - rewards.mean()) / (rewards.std(unbiased=False) + 1e-6)).detach().unsqueeze(-1)

    ratio = torch.exp((logp - old_logp.detach()).clamp(-20.0, 20.0))
    clipped = torch.clamp(ratio, 1.0 - clip_eps, 1.0 + clip_eps)
    pg_tok = -torch.minimum(ratio * adv, clipped * adv)

    log_r = (ref_logp.detach() - logp).clamp(-20.0, 20.0)
    kl_tok = torch.exp(log_r) - log_r - 1.0

    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    return (((pg_tok + kl_beta * kl_tok) * mask).sum(dim=-1) / seq_lens).mean()
`,
    experimentDiffCode: `def ppo_grpo_loss(logp, old_logp, ref_logp, mask, rewards, clip_eps=0.2, kl_beta=0.0):
    """Ablation: remove clipping and set KL beta = 0."""
    adv = ((rewards - rewards.mean()) / (rewards.std(unbiased=False) + 1e-6)).detach().unsqueeze(-1)
    ratio = torch.exp((logp - old_logp.detach()).clamp(-20.0, 20.0))
    pg_tok = -(ratio * adv)  # Unclipped!
    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    return ((pg_tok * mask).sum(dim=-1) / seq_lens).mean()
`,
  },

  {
    id: 'lesson-5',
    number: '05',
    shortTitle: { zh: '翻车图鉴与排错', en: 'Failure Modes' },
    title: {
      zh: '炼丹“翻车”图鉴：Reward Hacking 与熵坍塌',
      en: 'Diagnostic Field Guide: Reward Hacking & Entropy Collapse',
    },
    subtitle: {
      zh: '只看 Reward 曲线最容易被骗。学会联立观察 True Accuracy、Length、Entropy、KL 四条曲线做故障诊断。',
      en: 'Looking at reward alone will fool you. Learn to diagnose training failures jointly from Accuracy, Length, Entropy, and KL.',
    },
    mathPrereqs: [
      { zh: '信息论：香农熵 H(π)', en: 'Info Theory: Shannon Entropy H(π)' },
      { zh: '优化：Goodhart 定律', en: 'Optimization: Goodhart\'s Law' },
    ],
    estimatedTime: { zh: '~12 min (8GB)', en: '~12 min (8GB)' },
    defaultPresetId: 'reward_hacking',
    baselinePresetId: 'baseline_grpo',
    availablePresets: ['reward_hacking', 'entropy_collapse', 'baseline_grpo'],
    sections: [
      {
        heading: { zh: '1. 亲手制造一次 Reward Hacking', en: '1. Engineering a Clean Reward Hack' },
        paragraphs: [
          {
            zh: '在 Countdown 验证器里，只要注释掉“检查所用数字与题目列表严格一致”这一行，只检查算式结果是否等于目标值，模型就有机会利用一条捷径：无视给定数字，直接输出 <answer>{target}</answer>。',
            en: 'Comment out a single line in the Countdown verifier—checking that the used numbers match the prompt—and the model can exploit a shortcut: ignore the inputs and print <answer>{target}</answer>.',
          },
          {
            zh: '若策略反复使用这条捷径，可能出现奖励接近满分 1.1、真实准确率却下降的分歧。回复是否也变短、熵是否降低？对照回放里的样本和指标再判断。',
            en: 'If the policy repeatedly exploits the shortcut, reward may approach 1.1 even as true accuracy falls. Do responses also get shorter and less diverse? Check the samples and metrics in the replay.',
          },
        ],
        callout: {
          kind: 'warn',
          title: { zh: '炼丹排错口诀', en: 'Diagnostic Heuristic' },
          body: {
            zh: 'Reward 暴涨 + Length 骤降 + Entropy 归零 = 高度疑似 Reward Hacking；Entropy 过早归零 + Accuracy 停滞 = 低温/大步长导致的熵坍塌（可切到 L5 熵坍塌预设对比）。',
            en: 'Reward spike + Length cliff + Entropy -> 0 = likely Reward Hacking. Early Entropy -> 0 + flat Accuracy = Entropy Collapse from low temperature or aggressive LR (inspect the Entropy Collapse preset).',
          },
        },
      },
      {
        heading: { zh: '2. 策略熵坍塌（Entropy Collapse）', en: '2. Policy Entropy Collapse' },
        paragraphs: [
          {
            zh: '策略熵衡量模型探索多样性的余量。把采样温度压到 0.25 且弱化 KL 约束后，模型可能过早集中到最初碰对的一两种模板上。可结合熵的变化和组内样本的相似程度判断探索是否减少。',
            en: 'Policy entropy tracks remaining exploration capacity. Lowering sampling temperature to 0.25 with weak KL can concentrate the policy on its first successful templates. Compare entropy with the diversity of samples in each group to assess whether exploration has narrowed.',
          },
        ],
        formula: String.raw`H(\pi_\theta(\cdot \mid s_t)) = -\sum_{v \in \mathcal{V}} \pi_\theta(v \mid s_t)\,\log \pi_\theta(v \mid s_t)`,
      },
    ],
    predict: {
      title: { zh: '对照实验 4：注释掉验证器的一行数字检查', en: 'Ablation 4: Commenting Out the Number-Match Check' },
      prompt: {
        zh: '只删掉验证器里 `numbers_valid` 的约束，保留计算结果等于 `target` 的判定。训练到第 50 步后，仪表盘的 4 条曲线会出现哪组特征？',
        en: 'Remove only the `numbers_valid` check while still checking `eval(expr) == target`. After ~50 steps, what signature appears across the 4 dashboard charts?',
      },
      diffLines: [
        { type: 'ctx', text: 'def compute_reward(completion, numbers, target):' },
        { type: 'del', text: '-   if numbers_valid and target_matched: return 1.1' },
        { type: 'add', text: '+   if target_matched: return 1.1  # Bug: forgot to check given numbers!' },
      ],
      options: [
        { id: 'a', label: { zh: '观测奖励冲顶 1.1，但回复长度断崖暴跌、熵趋近 0、真实准确率归零', en: 'Observed reward hits 1.1, while length crashes, entropy -> 0, and true accuracy drops to ~0' } },
        { id: 'b', label: { zh: '模型依然会老实使用题目数字，偶尔才作弊一次', en: 'Model still mostly uses the given numbers with rare shortcuts' } },
        { id: 'c', label: { zh: '模型回复会越来越长，试图拼出更复杂的恒等式', en: 'Responses grow much longer to construct elaborate identities' } },
      ],
      correctOptionId: 'a',
      explanation: {
        zh: '一旦某条采样偶尔直接吐出了目标数字拿到满分，它的回复极短、log_prob 极高，梯度更新会立刻把这条捷径推成绝对主导策略。可在显微镜中查找 `REWARD HACK` 标记，核对当前样本是否利用了这条捷径。',
        en: 'The moment one rollout outputs the target literal and scores 1.1, its short length and high log-prob let gradient updates lock it in immediately. Look for `REWARD HACK` flags in the Microscope to check whether the current samples used this shortcut.',
      },
      experimentPresetId: 'reward_hacking',
      baselinePresetId: 'baseline_grpo',
    },
    codeFileName: 'lesson05_verifier.py',
    starterCode: `def compute_reward(completion, numbers, target):
    """Strict two-stage Countdown verifier (safe AST eval)."""
    m_think = re.search(r"<think>(.*?)</think>", completion, re.DOTALL)
    m_ans = re.search(r"<answer>(.*?)</answer>", completion, re.DOTALL)
    if not m_ans:
        return 0.0

    expr = m_ans.group(1).strip()
    fmt = 0.1 if (m_think and expr) else 0.0

    used = sorted(int(x) for x in re.findall(r"\\d+", expr))
    val = safe_eval_expr(expr)
    numbers_valid = (used == sorted(numbers))
    target_matched = (val is not None and abs(val - target) < 1e-5)

    return fmt + (1.0 if (numbers_valid and target_matched) else 0.0)
`,
    experimentDiffCode: `def compute_reward(completion, numbers, target):
    """Buggy verifier: omits numbers_valid -> triggers Reward Hacking."""
    m_think = re.search(r"<think>(.*?)</think>", completion, re.DOTALL)
    m_ans = re.search(r"<answer>(.*?)</answer>", completion, re.DOTALL)
    if not m_ans:
        return 0.0

    expr = m_ans.group(1).strip()
    fmt = 0.1 if (m_think and expr) else 0.0
    val = safe_eval_expr(expr)
    target_matched = (val is not None and abs(val - target) < 1e-5)

    # BUG: forgot to verify that expr uses the given numbers!
    return fmt + (1.0 if target_matched else 0.0)
`,
  },

  {
    id: 'lesson-6',
    number: '06',
    shortTitle: { zh: '离线 DPO 对比', en: 'Offline DPO vs RL' },
    title: {
      zh: '当没有规则验证器时：离线 DPO 与在线 RL 的边界',
      en: 'Without a Rule Verifier: Offline DPO vs. Online GRPO',
    },
    subtitle: {
      zh: '用同一个 Countdown 任务生成的（对, 错）样本对正面对比离线 DPO 与在线 GRPO，并衔接工业级框架。',
      en: 'Pit offline DPO (on Countdown chosen/rejected pairs) directly against online GRPO on the same task, then map the path to production frameworks.',
    },
    mathPrereqs: [
      { zh: '概率：Bradley-Terry 偏好模型', en: 'Probability: Bradley-Terry Model' },
      { zh: '高数：Sigmoid 与隐式奖励', en: 'Calculus: Sigmoid & Implicit Reward' },
    ],
    estimatedTime: { zh: '~10 min (8GB)', en: '~10 min (8GB)' },
    defaultPresetId: 'offline_dpo',
    baselinePresetId: 'baseline_grpo',
    availablePresets: ['offline_dpo', 'baseline_grpo'],
    sections: [
      {
        heading: { zh: '1. Bradley-Terry 到 DPO 损失', en: '1. From Bradley-Terry to the DPO Loss' },
        paragraphs: [
          {
            zh: '在写作、对话安全等开放域任务里，没有确定性规则可打分，往往只能收集人类偏好对 (y_w > y_l)。DPO 证明在 KL 约束下，最优策略与奖励函数存在闭式双射 r(x, y) = β log(π_θ / π_ref) + Z(x)，代入 Bradley-Terry 模型后配分函数 Z(x) 刚好消掉：',
            en: 'For open-ended writing or safety alignment, deterministic rules do not exist—we collect preference pairs (y_w > y_l). DPO uses the closed-form bijection r(x, y) = β log(π_θ / π_ref) + Z(x) under KL regularization so Z(x) cancels in the Bradley-Terry likelihood:',
          },
        ],
        formula: String.raw`\mathcal{L}_{\text{DPO}}(\theta) = -\log \sigma\!\left(\beta \log\frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log\frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}\right)`,
      },
      {
        heading: { zh: '2. 同台对照：离线固定数据 vs 在线持续探索', en: '2. Head-to-Head: Fixed Pairs vs. Online Rollouts' },
        paragraphs: [
          {
            zh: '在 Countdown 上用初始模型采样的“对-错回答对”训练 DPO，不需要在线采样循环。若策略更新后的新错误不在离线数据里，早期的进步就可能转为平台期。',
            en: 'Training DPO on Countdown preference pairs sampled from the initial model requires no online rollout loop. Early gains can plateau if the offline pairs do not cover mistakes made by the updated policy.',
          },
          {
            zh: '掌握了这 6 课的最小闭环后，迁移到 TRL、OpenRLHF 或 verl 等生产框架时，你看到的只是同样这几十行数学公式套上了 vLLM 推理引擎与 FSDP/Megatron 分布式外壳。',
            en: 'Once these six minimal loops are clear, scaling up to TRL, OpenRLHF, or verl is simply wrapping the same 30 lines of math inside vLLM rollout engines and FSDP/Megatron sharding.',
          },
        ],
      },
    ],
    predict: {
      title: { zh: '终极对照：同源数据的离线 DPO vs 在线 GRPO', en: 'Final Ablation: Offline DPO vs. Online GRPO on Countdown' },
      prompt: {
        zh: '同样基于 Qwen2.5-0.5B-Instruct 和 3 数字 Countdown，用初始模型预采样的（对, 错）对训练离线 DPO，对比全程在线采样的 GRPO，后半程谁的天花板更高？',
        en: 'Using the same Qwen2.5-0.5B-Instruct on 3-number Countdown, compare offline DPO on pre-sampled (chosen, rejected) pairs against online GRPO. How do their late-stage ceilings differ?',
      },
      diffLines: [
        { type: 'ctx', text: '# Same task, same 0.5B LoRA model, same 8GB budget' },
        { type: 'del', text: '- # Online GRPO: sample fresh rollouts from current pi_theta every step' },
        { type: 'add', text: '+ # Offline DPO: train on fixed (y_chosen, y_rejected) dataset from step 0' },
      ],
      options: [
        { id: 'a', label: { zh: 'DPO 更稳定且最终准确率高于在线 GRPO', en: 'DPO is cleaner and reaches higher final accuracy than online GRPO' } },
        { id: 'b', label: { zh: 'DPO 前期上升很快，但中后期在 ~47% 触顶并出现 KL 漂移；在线 GRPO 持续爬升至 ~68%', en: 'DPO climbs fast early but plateaus near ~47% with distribution shift; online GRPO keeps climbing to ~68%' } },
        { id: 'c', label: { zh: 'DPO 无法在数学推理任务上带来任何提升', en: 'DPO cannot improve math reasoning accuracy at all' } },
      ],
      correctOptionId: 'b',
      explanation: {
        zh: '离线 DPO 能迅速把初始分布里已有的好模式拉起来，但无法针对“学到一半产生的新错误”获得在线负反馈；当有廉价可验证奖励（RLVR）时，在线采样是拉开推理上限的关键。',
        en: 'Offline DPO quickly amplifies patterns present in the initial dataset, but gets no corrective feedback on new errors made after training shifts the policy. When cheap verifiers exist, online rollouts unlock a substantially higher ceiling.',
      },
      experimentPresetId: 'offline_dpo',
      baselinePresetId: 'baseline_grpo',
    },
    codeFileName: 'lesson06_dpo.py',
    starterCode: `def dpo_loss(pi_chosen, pi_rejected, ref_chosen, ref_rejected, beta=0.1):
    """Offline Direct Preference Optimization (Bradley-Terry) loss."""
    chosen_reward = beta * (pi_chosen - ref_chosen.detach())
    rejected_reward = beta * (pi_rejected - ref_rejected.detach())
    margin = chosen_reward - rejected_reward
    return -F.logsigmoid(margin).mean()
`,
    experimentDiffCode: `def dpo_loss(pi_chosen, pi_rejected, ref_chosen, ref_rejected, beta=0.5):
    """Higher beta (0.5): tighter tether to reference policy."""
    chosen_reward = beta * (pi_chosen - ref_chosen.detach())
    rejected_reward = beta * (pi_rejected - ref_rejected.detach())
    margin = chosen_reward - rejected_reward
    return -F.logsigmoid(margin).mean()
`,
  },
];
