import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Group,
  HoverCard,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { StepLog, TokenProbInfo } from '../types/lab';

type HeatmapMode = 'off' | 'prob' | 'entropy' | 'kl';

function tokenBgColor(tok: TokenProbInfo, mode: HeatmapMode): string {
  if (mode === 'prob') {
    const alpha = Math.max(0.08, Math.min(0.42, (1 - tok.prob) * 0.55));
    return tok.prob > 0.75
      ? `rgba(5, 150, 105, ${Math.min(0.28, tok.prob * 0.25)})`
      : `rgba(217, 119, 6, ${alpha})`;
  }
  if (mode === 'entropy') {
    const alpha = Math.max(0.06, Math.min(0.5, tok.entropy * 0.35));
    return `rgba(217, 119, 6, ${alpha})`;
  }
  if (mode === 'kl') {
    const alpha = Math.max(0.06, Math.min(0.55, tok.kl * 2.2));
    return `rgba(220, 38, 38, ${alpha})`;
  }
  return 'transparent';
}

interface RolloutMicroscopeProps {
  stepLog: StepLog | undefined;
}

export function RolloutMicroscope({ stepLog }: RolloutMicroscopeProps) {
  const { lang } = useLabStore();
  const [heatmap, setHeatmap] = useState<HeatmapMode>('prob');

  if (!stepLog) {
    return (
      <Paper p="lg" style={{ backgroundColor: 'var(--lab-surface)' }}>
        <Text size="sm" c="dimmed">
          {lang === 'zh' ? '暂无当前步的采样数据。' : 'No rollout samples for this step yet.'}
        </Text>
      </Paper>
    );
  }

  const hasTokenData = stepLog.samples.some((s) => s.token_probs?.length);
  const maxAbsAdv = Math.max(1.5, ...stepLog.samples.map((s) => Math.abs(s.advantage)));

  return (
    <Stack gap="sm">
      {/* Prompt & Group Summary Header */}
      <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="md" wrap="wrap">
            <Box>
              <Text size="11px" c="dimmed">
                {pickText(UI_STRINGS.promptNumbers, lang)}
              </Text>
              <Text size="sm" fw={700} ff="monospace">
                [{stepLog.prompt_numbers.join(', ')}]
              </Text>
            </Box>
            <Box>
              <Text size="11px" c="dimmed">
                {pickText(UI_STRINGS.promptTarget, lang)}
              </Text>
              <Text size="sm" fw={700} ff="monospace" c="cobalt">
                {stepLog.prompt_target}
              </Text>
            </Box>
            <Box>
              <Text size="11px" c="dimmed">
                {pickText(UI_STRINGS.promptRef, lang)}
              </Text>
              <Text size="sm" ff="monospace">
                {stepLog.prompt_solution}
              </Text>
            </Box>
            <Box>
              <Text size="11px" c="dimmed">
                {pickText(UI_STRINGS.groupStats, lang)}
              </Text>
              <Text size="xs" ff="monospace" className="tabular-nums">
                μ={stepLog.group_mean_reward.toFixed(2)} · σ={stepLog.group_std_reward.toFixed(2)}
              </Text>
            </Box>
          </Group>

          <Group gap={6}>
            <Text size="11px" c="dimmed">
              {hasTokenData
                ? pickText(UI_STRINGS.heatmapMode, lang)
                : lang === 'zh' ? '本步未记录逐词概率，显示原文' : 'No token probabilities recorded; showing text'}
            </Text>
            <SegmentedControl
              size="xs"
              disabled={!hasTokenData}
              value={hasTokenData ? heatmap : 'off'}
              onChange={(v) => setHeatmap(v as HeatmapMode)}
              data={[
                { label: pickText(UI_STRINGS.heatmapOff, lang), value: 'off' },
                { label: pickText(UI_STRINGS.heatmapProb, lang), value: 'prob' },
                { label: pickText(UI_STRINGS.heatmapEntropy, lang), value: 'entropy' },
                { label: pickText(UI_STRINGS.heatmapKl, lang), value: 'kl' },
              ]}
            />
          </Group>
        </Group>
      </Paper>

      {stepLog.zero_grad_group && (
        <Alert color="gray" variant="light" icon={<Info size={15} />}>
          <Text size="xs">{pickText(UI_STRINGS.zeroGradBanner, lang)}</Text>
        </Alert>
      )}

      {/* Group Rollout Cards */}
      <Stack gap={8}>
        {stepLog.samples.map((sample) => {
          const adv = sample.advantage;
          const isHack = sample.breakdown.hack_detected;
          const isExact = sample.breakdown.numbers_valid && sample.breakdown.target_matched;
          const borderAccent = isHack
            ? '#dc2626'
            : adv > 0.05
              ? '#059669'
              : adv < -0.05
                ? '#dc2626'
                : '#94a3b8';

          const barPct = Math.min(100, (Math.abs(adv) / maxAbsAdv) * 100);

          return (
            <Paper
              key={sample.index}
              p="sm"
              style={{
                backgroundColor: 'var(--lab-surface)',
                borderLeft: `3px solid ${borderAccent}`,
              }}
            >
              {/* Top Row: Sample ID + Advantage Direction + Reward Badges */}
              <Group justify="space-between" mb={6} wrap="wrap" gap={8}>
                <Group gap={8} wrap="wrap">
                  <Text size="xs" fw={700} ff="monospace" c="dimmed">
                    #{sample.index + 1}
                  </Text>
                  <Badge
                    size="xs"
                    color={adv > 0.05 ? 'teal' : adv < -0.05 ? 'red' : 'gray'}
                    variant="light"
                    style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
                  >
                    A = {adv >= 0 ? `+${adv.toFixed(2)}` : adv.toFixed(2)} ·{' '}
                    {adv > 0.05
                      ? pickText(UI_STRINGS.advantagePush, lang)
                      : adv < -0.05
                        ? pickText(UI_STRINGS.advantagePull, lang)
                        : pickText(UI_STRINGS.advantageNeutral, lang)}
                  </Badge>
                  <Badge
                    size="xs"
                    color="gray"
                    variant="outline"
                    style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
                  >
                    R = {sample.reward.toFixed(2)}
                  </Badge>
                  <Text size="11px" ff="monospace" c="dimmed">
                    {sample.num_tokens} tok · logp {sample.mean_log_prob.toFixed(2)}
                  </Text>
                </Group>

                <Group gap={5}>
                  {isHack && (
                    <Badge size="xs" color="red" variant="filled" leftSection={<AlertTriangle size={11} />}>
                      {pickText(UI_STRINGS.hackBadge, lang)}
                    </Badge>
                  )}
                  <Badge
                    size="xs"
                    color={sample.breakdown.format_reward > 0 ? 'teal' : 'gray'}
                    variant="outline"
                  >
                    {pickText(UI_STRINGS.formatReward, lang)} {sample.breakdown.format_reward > 0 ? '+' : ''}{sample.breakdown.format_reward}
                  </Badge>
                  {!isHack && (
                    <Badge
                      size="xs"
                      color={isExact ? 'teal' : 'red'}
                      variant="light"
                      leftSection={isExact ? <Check size={11} /> : <X size={11} />}
                    >
                      {isExact
                        ? pickText(UI_STRINGS.exactMatch, lang)
                        : sample.breakdown.numbers_valid
                          ? `= ${sample.breakdown.evaluated_value ?? '?'}`
                          : pickText(UI_STRINGS.numMismatch, lang)}
                    </Badge>
                  )}
                </Group>
              </Group>

              {/* Diverging Advantage Visual Meter */}
              <Box mb={8} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Box style={{ flex: 1, height: 5, background: 'var(--lab-subtle)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '50%',
                      width: 1,
                      background: 'var(--lab-border)',
                    }}
                  />
                  {adv !== 0 && (
                    <Box
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: adv > 0 ? '50%' : `${50 - barPct / 2}%`,
                        width: `${barPct / 2}%`,
                        backgroundColor: adv > 0 ? '#059669' : '#dc2626',
                        borderRadius: 2,
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* Completion Body: Token Heatmap (when available & enabled) OR Clean Think/Answer */}
              {heatmap !== 'off' && sample.token_probs?.length ? (
                <Box
                  p={8}
                  style={{
                    backgroundColor: 'var(--lab-formula-bg)',
                    border: '1px solid var(--lab-border)',
                    borderRadius: 4,
                    lineHeight: 1.8,
                  }}
                >
                  {sample.token_probs.map((tok, tIdx) => (
                    <HoverCard key={tIdx} width={230} shadow="sm" openDelay={80} withArrow>
                      <HoverCard.Target>
                        <span
                          className="token-chip"
                          style={{ backgroundColor: tokenBgColor(tok, heatmap) }}
                        >
                          {tok.token}
                        </span>
                      </HoverCard.Target>
                      <HoverCard.Dropdown p="xs">
                        <Group justify="space-between" mb={4}>
                          <Text size="xs" fw={700} ff="monospace">
                            {JSON.stringify(tok.token)}
                          </Text>
                          <Text size="11px" ff="monospace" c="dimmed">
                            logp {tok.log_prob.toFixed(2)}
                          </Text>
                        </Group>
                        <Group gap={10} mb={6}>
                          <Text size="11px" ff="monospace">
                            p={(tok.prob * 100).toFixed(1)}%
                          </Text>
                          <Text size="11px" ff="monospace" c="orange">
                            H={tok.entropy.toFixed(2)}
                          </Text>
                          <Text size="11px" ff="monospace" c="red">
                            KL={tok.kl.toFixed(3)}
                          </Text>
                        </Group>
                        <Text size="10px" c="dimmed" fw={600} mb={4}>
                          {pickText(UI_STRINGS.topCandidates, lang)}
                        </Text>
                        <Stack gap={4}>
                          {tok.top_candidates.map((cand, cIdx) => (
                            <Box key={cIdx}>
                              <Group justify="space-between" mb={1}>
                                <Text size="11px" ff="monospace">
                                  {cand.token}
                                </Text>
                                <Text size="11px" ff="monospace" className="tabular-nums">
                                  {(cand.prob * 100).toFixed(1)}%
                                </Text>
                              </Group>
                              <Progress
                                value={cand.prob * 100}
                                size={4}
                                color={cIdx === 0 ? 'cobalt' : 'gray'}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </HoverCard.Dropdown>
                    </HoverCard>
                  ))}
                </Box>
              ) : (
                <Stack gap={4}>
                  {!sample.token_probs?.length ? (
                    <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {sample.raw_text || (lang === 'zh' ? '（空回复）' : '(empty response)')}
                    </Text>
                  ) : sample.think_text && (
                    <Text
                      size="xs"
                      c="dimmed"
                      lh={1.55}
                      style={{
                        backgroundColor: 'var(--lab-subtle)',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontFamily: 'var(--mantine-font-family-monospace)',
                      }}
                    >
                      &lt;think&gt; {sample.think_text} &lt;/think&gt;
                    </Text>
                  )}
                  <Group gap={8} align="center">
                    {!!sample.token_probs?.length && (
                      <Text size="xs" ff="monospace" fw={600}>
                        &lt;answer&gt;{sample.answer_text || '(empty)'}&lt;/answer&gt;
                      </Text>
                    )}
                    <Text size="11px" c="dimmed">
                      — {sample.breakdown.reason}
                    </Text>
                  </Group>
                </Stack>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Stack>
  );
}
