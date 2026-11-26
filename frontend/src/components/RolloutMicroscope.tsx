import { useState } from 'react';
import {
  Box,
  Group,
  HoverCard,
  Progress,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { AlertTriangle, CheckCircle, CloseCircle, InfoCircle } from 'reicon-react';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { StepLog, TokenProbInfo } from '../types/lab';
import { LabIcon } from './LabIcon';

type HeatmapMode = 'off' | 'prob' | 'entropy' | 'kl';

function tokenBgColor(tok: TokenProbInfo, mode: HeatmapMode): string {
  // Single-accent intensity scale (90% neutral / 10% accent)
  if (mode === 'prob') {
    const alpha = Math.max(0.06, Math.min(0.28, tok.prob * 0.28));
    return `rgba(0, 113, 227, ${alpha})`;
  }
  if (mode === 'entropy') {
    const alpha = Math.max(0.05, Math.min(0.32, tok.entropy * 0.26));
    return `rgba(0, 113, 227, ${alpha})`;
  }
  if (mode === 'kl') {
    const alpha = Math.max(0.05, Math.min(0.38, tok.kl * 1.8));
    return `rgba(0, 113, 227, ${alpha})`;
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
      <Text fz={14} style={{ color: 'var(--lab-muted)' }}>
        {lang === 'zh' ? '暂无当前步的采样数据。' : 'No rollout samples for this step yet.'}
      </Text>
    );
  }

  const hasTokenData = stepLog.samples.some((s) => s.token_probs?.length);
  const maxAbsAdv = Math.max(1.5, ...stepLog.samples.map((s) => Math.abs(s.advantage)));

  return (
    <Stack gap={24}>
      {/* Borderless Prompt & Group Summary Header */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap={24} className="intent-zone">
        <Group gap={32} wrap="wrap">
          <Box>
            <Text fz={14} mb={4} style={{ color: 'var(--lab-muted)' }}>
              {pickText(UI_STRINGS.promptNumbers, lang)}
            </Text>
            <Text fz={18} fw={600} ff="monospace" style={{ color: 'var(--lab-text)' }}>
              [{stepLog.prompt_numbers.join(', ')}]
            </Text>
          </Box>
          <Box>
            <Text fz={14} mb={4} style={{ color: 'var(--lab-muted)' }}>
              {pickText(UI_STRINGS.promptTarget, lang)}
            </Text>
            <Text fz={18} fw={700} ff="monospace" style={{ color: 'var(--lab-accent)' }}>
              {stepLog.prompt_target}
            </Text>
          </Box>
          <Box>
            <Text fz={14} mb={4} style={{ color: 'var(--lab-muted)' }}>
              {pickText(UI_STRINGS.promptRef, lang)}
            </Text>
            <Text fz={16} fw={500} ff="monospace" style={{ color: 'var(--lab-text)' }}>
              {stepLog.prompt_solution}
            </Text>
          </Box>
          <Box>
            <Text fz={14} mb={4} style={{ color: 'var(--lab-muted)' }}>
              {pickText(UI_STRINGS.groupStats, lang)}
            </Text>
            <Text fz={14} fw={500} ff="monospace" className="tabular-nums" style={{ color: 'var(--lab-text)' }}>
              μ {stepLog.group_mean_reward.toFixed(2)} · σ {stepLog.group_std_reward.toFixed(2)}
            </Text>
          </Box>
        </Group>

        {hasTokenData && (
          <SegmentedControl
            size="xs"
            value={heatmap}
            onChange={(v) => setHeatmap(v as HeatmapMode)}
            data={[
              { label: pickText(UI_STRINGS.heatmapOff, lang), value: 'off' },
              { label: pickText(UI_STRINGS.heatmapProb, lang), value: 'prob' },
              { label: pickText(UI_STRINGS.heatmapEntropy, lang), value: 'entropy' },
              { label: pickText(UI_STRINGS.heatmapKl, lang), value: 'kl' },
            ]}
          />
        )}
      </Group>

      {stepLog.zero_grad_group && (
        <Group
          gap={12}
          p={16}
          wrap="nowrap"
          style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 12 }}
        >
          <LabIcon icon={InfoCircle} color="var(--lab-muted)" />
          <Text fz={14} style={{ color: 'var(--lab-muted)' }}>
            {pickText(UI_STRINGS.zeroGradBanner, lang)}
          </Text>
        </Group>
      )}

      {/* Single-level Flat Rollout Surfaces (no nested boxes, no badge clutter) */}
      <Stack gap={16}>
        {stepLog.samples.map((sample) => {
          const adv = sample.advantage;
          const isHack = sample.breakdown.hack_detected;
          const isExact = sample.breakdown.numbers_valid && sample.breakdown.target_matched;
          const barPct = Math.min(100, (Math.abs(adv) / maxAbsAdv) * 100);

          return (
            <Box
              key={sample.index}
              p={20}
              style={{
                backgroundColor: 'var(--lab-surface)',
                borderRadius: 16,
              }}
            >
              {/* Single compact metadata line */}
              <Group justify="space-between" mb={12} wrap="wrap" gap={12}>
                <Group gap={16} wrap="wrap">
                  <Text fz={14} fw={600} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
                    #{sample.index + 1}
                  </Text>
                  <Text
                    fz={14}
                    fw={600}
                    ff="monospace"
                    className="tabular-nums"
                    style={{ color: adv > 0.05 ? 'var(--lab-accent)' : 'var(--lab-text)' }}
                  >
                    A {adv >= 0 ? `+${adv.toFixed(2)}` : adv.toFixed(2)}
                  </Text>
                  <Text fz={14} ff="monospace" className="tabular-nums" style={{ color: 'var(--lab-text)' }}>
                    R {sample.reward.toFixed(2)}
                  </Text>
                  <Text fz={14} ff="monospace" className="tabular-nums" style={{ color: 'var(--lab-muted)' }}>
                    {sample.num_tokens} tok
                  </Text>
                </Group>

                <Group gap={8}>
                  <LabIcon
                    icon={isHack ? AlertTriangle : isExact ? CheckCircle : CloseCircle}
                    color={isExact && !isHack ? 'var(--lab-accent)' : 'var(--lab-muted)'}
                  />
                  <Text
                    fz={14}
                    fw={isHack || isExact ? 600 : 400}
                    style={{
                      color: isExact && !isHack ? 'var(--lab-accent)' : 'var(--lab-muted)',
                    }}
                  >
                    {isHack
                      ? pickText(UI_STRINGS.hackBadge, lang)
                      : isExact
                        ? pickText(UI_STRINGS.exactMatch, lang)
                        : sample.breakdown.numbers_valid
                          ? `= ${sample.breakdown.evaluated_value ?? '?'}`
                          : pickText(UI_STRINGS.numMismatch, lang)}
                  </Text>
                </Group>
              </Group>

              {/* Subtle Diverging Advantage Track */}
              <Box
                mb={16}
                style={{
                  height: 4,
                  backgroundColor: 'var(--lab-surface-hover)',
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {adv !== 0 && (
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: adv > 0 ? '50%' : `${50 - barPct / 2}%`,
                      width: `${barPct / 2}%`,
                      backgroundColor: adv > 0 ? 'var(--lab-accent)' : 'var(--lab-muted)',
                      borderRadius: 4,
                    }}
                  />
                )}
              </Box>

              {/* Body directly inside the surface (no nested inner boxes) */}
              {heatmap !== 'off' && sample.token_probs?.length ? (
                <Box style={{ lineHeight: 1.9 }}>
                  {sample.token_probs.map((tok, tIdx) => (
                    <HoverCard key={tIdx} width={240} openDelay={80} radius="lg">
                      <HoverCard.Target>
                        <span
                          className="token-chip"
                          style={{ backgroundColor: tokenBgColor(tok, heatmap) }}
                        >
                          {tok.token}
                        </span>
                      </HoverCard.Target>
                      <HoverCard.Dropdown p={16}>
                        <Group justify="space-between" mb={8}>
                          <Text fz={14} fw={600} ff="monospace">
                            {JSON.stringify(tok.token)}
                          </Text>
                          <Text fz={12} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
                            {(tok.prob * 100).toFixed(1)}%
                          </Text>
                        </Group>
                        <Stack gap={8}>
                          {tok.top_candidates.map((cand, cIdx) => (
                            <Box key={cIdx}>
                              <Group justify="space-between" mb={4}>
                                <Text fz={12} ff="monospace">
                                  {cand.token}
                                </Text>
                                <Text fz={12} ff="monospace" className="tabular-nums" style={{ color: 'var(--lab-muted)' }}>
                                  {(cand.prob * 100).toFixed(1)}%
                                </Text>
                              </Group>
                              <Progress
                                value={cand.prob * 100}
                                size={4}
                                color={cIdx === 0 ? 'accent' : 'gray'}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </HoverCard.Dropdown>
                    </HoverCard>
                  ))}
                </Box>
              ) : (
                <Stack gap={8}>
                  {!sample.token_probs?.length ? (
                    <Text
                      fz={14}
                      ff="monospace"
                      lh={1.65}
                      style={{
                        color: 'var(--lab-text)',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {sample.raw_text || (lang === 'zh' ? '（空回复）' : '(empty response)')}
                    </Text>
                  ) : (
                    <>
                      {sample.think_text && (
                        <Text fz={14} lh={1.65} style={{ color: 'var(--lab-muted)' }}>
                          {sample.think_text}
                        </Text>
                      )}
                      <Text fz={14} ff="monospace" fw={600} style={{ color: 'var(--lab-text)' }}>
                        {sample.answer_text || '(empty)'}
                      </Text>
                    </>
                  )}
                </Stack>
              )}
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
