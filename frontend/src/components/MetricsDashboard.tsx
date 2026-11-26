import { useMemo } from 'react';
import { Box, SimpleGrid, Text, useComputedColorScheme } from '@mantine/core';
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
  const gridColor = scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,24,0.06)';
  const axisColor = scheme === 'dark' ? '#9a9a9e' : '#6a6a6a';
  const primaryStroke = scheme === 'dark' ? '#2997ff' : '#0071e3';
  const secondaryStroke = scheme === 'dark' ? '#d4d4d8' : '#181818';
  const baselineStroke = scheme === 'dark' ? '#636366' : '#a1a1aa';

  const currentStepLog = activeRun?.steps[Math.min(stepIndex, (activeRun?.steps.length ?? 1) - 1)];
  const curStepNum = currentStepLog?.step ?? 0;

  const chartData = useMemo(() => {
    if (!activeRun) return [];
    const baselineByStep = new Map(
      compareBaseline ? baselineRun?.steps.map((s) => [s.step, s.metrics]) : []
    );
    return activeRun.steps.map((s) => {
      const b = baselineByStep.get(s.step);
      return {
        step: s.step,
        accuracy: Number((s.metrics.accuracy * 100).toFixed(1)),
        baseAccuracy: b ? Number((b.accuracy * 100).toFixed(1)) : undefined,
        meanReward: Number(s.metrics.mean_reward.toFixed(2)),
        length: s.metrics.mean_response_length,
        baseLength: b?.mean_response_length,
        entropy: s.metrics.entropy,
        baseEntropy: b?.entropy,
        kl: s.metrics.kl_divergence,
        baseKl: b?.kl_divergence,
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
      value: m ? `${(m.accuracy * 100).toFixed(1)}%` : '—',
      accent: true,
    },
    {
      label: pickText(UI_STRINGS.kpiReward, lang),
      value: m ? m.mean_reward.toFixed(2) : '—',
      accent: false,
    },
    {
      label: pickText(UI_STRINGS.kpiLen, lang),
      value: m ? `${m.mean_response_length.toFixed(0)}` : '—',
      accent: false,
    },
    {
      label: pickText(UI_STRINGS.kpiEnt, lang),
      value: m ? m.entropy.toFixed(3) : '—',
      accent: false,
    },
    {
      label: pickText(UI_STRINGS.kpiKl, lang),
      value: m ? m.kl_divergence.toFixed(3) : '—',
      accent: false,
    },
    {
      label: pickText(UI_STRINGS.kpiVram, lang),
      value: m ? `${m.vram_peak_gb.toFixed(2)} GB` : '—',
      accent: false,
    },
  ];

  const tooltipStyle = {
    backgroundColor: scheme === 'dark' ? '#18181b' : '#ffffff',
    border: `1px solid ${scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(24,24,24,0.1)'}`,
    borderRadius: 12,
    fontSize: 12,
    fontFamily: '"Geist Mono", monospace',
  };

  return (
    <Box>
      {/* Borderless 6-column typographic KPI strip (90% neutral, 10% accent on primary Pass@1) */}
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing={24} mb={24} px={4}>
        {kpis.map((item) => (
          <Box key={item.label}>
            <Text fz={14} fw={400} mb={4} truncate style={{ color: 'var(--lab-muted)' }}>
              {item.label}
            </Text>
            <Text
              fz={20}
              fw={600}
              ff="monospace"
              className="tabular-nums"
              style={{ color: item.accent ? 'var(--lab-accent)' : 'var(--lab-text)' }}
            >
              {item.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* 2x2 Flat Borderless Telemetry Charts (20px spacing, 20px padding, 16px radius) */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={20}>
        {/* Chart 1: Accuracy & Reward */}
        <Box p={20} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
          <Text fz={16} fw={600} mb={12} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.chartAccTitle, lang)}
          </Text>
          <Box h={184}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  type="number"
                  dataKey="step"
                  domain={['dataMin', 'dataMax']}
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, (dataMax: number) => (dataMax > 1.3 ? Math.ceil(dataMax) : 1.2)]}
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine yAxisId="left" x={curStepNum} stroke={primaryStroke} strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="baseAccuracy"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke={baselineStroke}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    connectNulls
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="accuracy"
                  name={`${pickText(UI_STRINGS.legendActive, lang)} (%)`}
                  stroke={primaryStroke}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="meanReward"
                  name={pickText(UI_STRINGS.legendReward, lang)}
                  stroke={secondaryStroke}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Chart 2: Response Length */}
        <Box p={20} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
          <Text fz={16} fw={600} mb={12} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.chartLenTitle, lang)}
          </Text>
          <Box h={184}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  type="number"
                  dataKey="step"
                  domain={['dataMin', 'dataMax']}
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, activeRun?.metadata.max_new_tokens ?? 260]}
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine x={curStepNum} stroke={primaryStroke} strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baseLength"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke={baselineStroke}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    connectNulls
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="length"
                  name={pickText(UI_STRINGS.legendActive, lang)}
                  stroke={primaryStroke}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Chart 3: Policy Entropy */}
        <Box p={20} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
          <Text fz={16} fw={600} mb={12} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.chartEntTitle, lang)}
          </Text>
          <Box h={184}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  type="number"
                  dataKey="step"
                  domain={['dataMin', 'dataMax']}
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine x={curStepNum} stroke={primaryStroke} strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baseEntropy"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke={baselineStroke}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    connectNulls
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="entropy"
                  name={pickText(UI_STRINGS.legendActive, lang)}
                  stroke={primaryStroke}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Chart 4: KL Divergence & Clip Fraction */}
        <Box p={20} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
          <Text fz={16} fw={600} mb={12} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.chartKlTitle, lang)}
          </Text>
          <Box h={184}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  type="number"
                  dataKey="step"
                  domain={['dataMin', 'dataMax']}
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 40]}
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine yAxisId="left" x={curStepNum} stroke={primaryStroke} strokeDasharray="3 3" />
                {compareBaseline && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="baseKl"
                    name={pickText(UI_STRINGS.legendBaseline, lang)}
                    stroke={baselineStroke}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    connectNulls
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="kl"
                  name="KL (k3)"
                  stroke={primaryStroke}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="clip"
                  name={`${pickText(UI_STRINGS.legendClip, lang)} (%)`}
                  stroke={secondaryStroke}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
