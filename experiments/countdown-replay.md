# Countdown GPU 实测回放

`frontend/src/data/demoRuns.json` 包含 10 个真实运行、384 步、2,304 条模型回答。每一步保留一整组原文、判分明细，以及第一个样本的逐词概率、熵、相对底模的 k3 KL 估计与 Top-5。逐词概率来自模型原始分布，不是温度和截断采样后的分布。无需后端即可回放。

**推荐先看第 5 课 → 奖励漏洞（`reward_hacking`）→ 步 6 → 采样显微镜 → 样本 #3。** 给定 `[2, 8, 9]`、目标 `7`，模型回答 `(9 - 2)`，没用 `8`，宽松判分却给了 `1.1`。这组总共出现 8 条这样的回答，没有一条严格正确。

## 结果

每行是一趟独立运行；除冻结探针外，各组从相同底模重新初始化，按相同顺序取 40 道题，每题采样 6 次。正确数要求算式结果匹配且给定数字恰好各用一次。「格式合格」统一用标准格式检查重新计算，即使该组训练时不给格式分也按相同口径统计。均分是该组**自己的**奖励，跨组不一定可比。显存是 PyTorch 进程的峰值已分配量，不含桌面等其他开销。

| 预设 | 步数 | 严格正确 | 格式合格 | 漏用或错用数字仍得正确分 | 平均奖励 | 显存峰值 GiB |
|---|---:|---:|---:|---:|---:|---:|
| `sft_probe`（冻结） | 24 | 2/144 | 90/144 | 0 | 0.076 | 1.40 |
| `reinforce_basic` | 40 | 0/240 | 161/240 | 0 | 0.067 | 3.49 |
| `no_format_reward` | 40 | 1/240 | 146/240 | 0 | 0.004 | 2.50 |
| `baseline_grpo` | 40 | 1/240 | 225/240 | 0 | 0.098 | 2.39 |
| `reward_shift_plus10` | 40 | 0/240 | 15/240 | 0 | 10.006 | 3.49 |
| `ppo_multi_epoch` | 40 | 3/240 | 219/240 | 0 | 0.104 | 2.92 |
| `kl_zero_collapse` | 40 | 0/240 | 217/240 | 0 | 0.090 | 3.49 |
| `reward_hacking` | 40 | 0/240 | 230/240 | 8 | 0.129 | 2.39 |
| `entropy_collapse`（低温） | 40 | 18/240 | 239/240 | 0 | 0.175 | 2.32 |
| `offline_dpo` | 40 | 4/240 | 159/240 | 0 | 0.083 | 1.50 |

**不能把这张表当算法排行榜。** 这是单种子、短程运行中的采样结果，不是训练结束后在独立测试集上的成绩。低温组的 6 条回答尤其容易重复。GRPO 的 40 组里有 30 组同题同分，未做策略更新；没有证据说明它在本设置中学会了算术。DPO 从独立的冻结探针中只提取到 2 对同题正确/错误回答，循环使用，评估回答不参与 DPO 更新。课程中的长程预测不是本次观测。

## 录制条件与复跑

- RTX 4070 Ti（12 GB），BF16，LoRA rank 16；Python 3.12.10、PyTorch 2.7.1+cu126、Transformers 4.57.3、PEFT 0.17.1、Accelerate 1.9.0。不是在 8 GB 卡上测得。
- 模型 `Qwen/Qwen2.5-0.5B-Instruct`，revision `7ae557604adf67be50417f59c2c2f167def9a775`，`model.safetensors` SHA-256 `fdf756fa7fcbe7404d5c60e26bff1a0c8b8aa1f72ced49e7dd0210fe288fb7fe`。
- 采样种子 2026；冻结探针题库种子 123，其他组 42，实际两组无相同题目。沿用各预设超参和 256 个新 token 的生成上限。每步先采样记录，再更新；探针不更新。不保存或上传模型权重。
- 提示词校准：先把一个示例放在用户消息中，冻结模型在 144 条回答中格式合格 5 条、严格正确 0 条。正式录制固定使用两个独立的示范对话轮次，同样的题目与抽样数，格式合格 90 条、严格正确 2 条。校准轮不与正式回放混算。

将上述模型快照路径设为 `MODEL`，在安装好 GPU 依赖的 Python 环境里运行：

```bash
python backend/scripts/record_replay.py sft_probe --model-path "$MODEL" --steps 24 --group-size 6
for p in baseline_grpo reinforce_basic no_format_reward reward_shift_plus10 ppo_multi_epoch kl_zero_collapse reward_hacking entropy_collapse; do
  python backend/scripts/record_replay.py "$p" --model-path "$MODEL" || exit 1
done
python backend/scripts/record_replay.py offline_dpo --model-path "$MODEL" --probe runs/capture/sft_probe.json
python backend/scripts/bundle_replay.py runs/capture frontend/src/data/demoRuns.json
```

打包时逐条按原文重算奖励与准确率，检查 10 个预设、步序、组内样本、逐词记录和对照题目。不同软硬件不保证逐位重现。
