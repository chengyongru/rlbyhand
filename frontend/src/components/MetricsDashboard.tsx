import { useMemo } from 'react';
import { Box, Group, Paper, SimpleGrid, Text, useComputedColorScheme } from '@mantine/core';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { RunLog } from '../types/lab';

interface MetricsDashboardProps {
  activeRun: RunLog | undefined;
  baselineRun: RunLog | undefined;
}

export function MetricsDashboard({ activeRun, baselineRun }: MetricsDashboardProps) {
  const { lang, stepIndex, setStepIndex, compareBaseline } = useLabStore();
  const scheme = useComputedColorScheme('light');
  const gridColor = scheme === 'dark' ? '#262c36' : '#ecece9';
  const axisColor = scheme === 'dark' ? '#8b949e' : '#71717a';

  const currentStepLog = activeRun?.steps[Math.min(stepIndex, (activeRun?.steps.length ?? 1) - 1)];
  const curStepNum = currentStepLog?.step ?? 0;

  const chartData = useMemo(() => {
    if (!activeRun) return [];
    return activeRun.steps.map((s, idx) => {
      const b = baselineRun?.steps[Math.min(idx, (baselineRun?.steps.length ?? 1) - 1)];
      return {
        idx,
        step: s.step,
        accuracy: Number((s.metrics.accuracy * 100).toFixed(1)),
        baseAccuracy:
          compareBaseline && b ? Number((b.metrics.accuracy * 100).toFixed(1)) : undefined,
        meanReward: Number(s.metrics.mean_reward.toFixed(2)),
        length: s.metrics.mean_response_length,
        baseLength: compareBaseline && b ? b.metrics.mean_response_length : undefined,
        entropy: s.metrics.entropy,
        baseEntropy: compareBaseline && b ? b.metrics.entropy : undefined,
        kl: s.metrics.kl_divergence,
        baseKl: compareBaseline && b ? b.metrics.kl_divergence : undefined,
        clip: Number((s.metrics.clip_fraction * 100).toFixed(1)),
      };
    });
  }, [activeRun, baselineRun, compareBaseline]);

  const handleChartClick = (state: { activeTooltipIndex?: number } | null) => {
    if (state && typeof state.activeTooltipIndex === 'number') {
      setStepIndex(state.activeTooltipIndex);
    }
  };

  const m = currentStepLog?.metrics;

  const kpis = [
    {
      label: pickText(UI_STRINGS.kpiAcc, lang),
      value: m ? `${(m.accuracy * 100).toFixed(1)}%` : '--',
      color: '#1d4ed8',
    },
    {
      label: pickText(UI_STRINGS.kpiReward, lang),
      value: m ? m.mean_reward.toFixed(2) : '--',
      color: '#059669',
    },
    {
      label: pickText(UI_STRINGS.kpiLen, lang),
      value: m ? `${m.mean_response_length.toFixed(0)} tok` : '--',
      color: undefined,
    },
    {
      label: pickText(UI_STRINGS.kpiEnt, lang),
      value: m ? m.entropy.toFixed(3) : '--',
      color: '#d97706',
    },
    {
      label: pickText(UI_STRINGS.kpiKl, lang),
      value: m ? m.kl_divergence.toFixed(3) : '--',
      color: m && m.kl_divergence > 0.35 ? '#dc2626' : undefined,
    },
    {
      label: pickText(UI_STRINGS.kpiVram, lang),
      value: m ? `${m.vram_peak_gb.toFixed(2)} GB` : '--',
      color: m && m.vram_peak_gb > 6.5 ? '#dc2626' : '#059669',
    },
  ];

  const tooltipStyle = {
    backgroundColor: scheme === 'dark' ? '#161b22' : '#ffffff',
    border: `1px solid ${scheme === 'dark' ? '#30363d' : '#e4e4e7'}`,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'var(--mantine-font-family-monospace)',
  };

  return (
    <Box>
      {/* Top 6 KPI Strip */}
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing={8} mb="sm">
        {kpis.map((item) => (
          <Paper
            key={item.label}
            p="xs"
            style={{ backgroundColor: 'var(--lab-surface)', borderColor: 'var(--lab-border)' }}
          >
            <Text size="11px" c="dimmed" truncate>
              {item.label}
            </Text>
            <Text
              size="md"
              fw={700}
              ff="monospace"
              className="tabular-nums"
              style={{ color: item.color ?? 'var(--lab-text)' }}
            >
              {item.value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      {/* 2x2 Synchronized Telemetry Charts */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
        {/* Chart 1: Accuracy & Reward */}
        <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={600}>
              {pickText(UI_STRINGS.chartAccTitle, lang)}
            </Text>
            <Text size="11px" c="dimmed" ff="monospace">
              % / reward
            </Text>
          </Group>
          <Box h={195}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} width={34} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, (dataMax: number) => (dataMax > 1.3 ? Math.ceil(dataMax) : 1.2)]}
                  tick={{ fontSize: 11, fill: axisColor }}
                  width={36}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="left" x={curStepNum} stroke="#1d4ed8" strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="baseAccuracy"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke="#94a3b8"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="accuracy"
                  name={`${pickText(UI_STRINGS.legendActive, lang)} (%)`}
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="meanReward"
                  name={pickText(UI_STRINGS.legendReward, lang)}
                  stroke="#059669"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Chart 2: Response Length */}
        <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={600}>
              {pickText(UI_STRINGS.chartLenTitle, lang)}
            </Text>
            <Text size="11px" c="dimmed" ff="monospace">
              max=256
            </Text>
          </Group>
          <Box h={195}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis domain={[0, 260]} tick={{ fontSize: 11, fill: axisColor }} width={34} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x={curStepNum} stroke="#1d4ed8" strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baseLength"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke="#94a3b8"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="length"
                  name={pickText(UI_STRINGS.legendActive, lang)}
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Chart 3: Policy Entropy */}
        <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={600}>
              {pickText(UI_STRINGS.chartEntTitle, lang)}
            </Text>
            <Text size="11px" c="dimmed" ff="monospace">
              H(π)
            </Text>
          </Group>
          <Box h={195}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} width={34} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x={curStepNum} stroke="#1d4ed8" strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baseEntropy"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke="#94a3b8"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="entropy"
                  name={pickText(UI_STRINGS.legendActive, lang)}
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Chart 4: KL Divergence & Clip Fraction */}
        <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={600}>
              {pickText(UI_STRINGS.chartKlTitle, lang)}
            </Text>
            <Text size="11px" c="dimmed" ff="monospace">
              k3 / clip%
            </Text>
          </Group>
          <Box h={195}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: axisColor }} width={36} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 40]} tick={{ fontSize: 11, fill: axisColor }} width={34} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="left" x={curStepNum} stroke="#1d4ed8" strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="baseKl"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke="#94a3b8"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="kl"
                  name="KL (k3)"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="clip"
                  name={`${pickText(UI_STRINGS.legendClip, lang)} (%)`}
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </SimpleGrid>
    </Box>
  );
}
