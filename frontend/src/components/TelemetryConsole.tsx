import { useRef } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { Download, Upload } from 'lucide-react';
import { isValidRunLog } from '../api/client';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { RunLog } from '../types/lab';

interface TelemetryConsoleProps {
  activeRun: RunLog | undefined;
}

export function TelemetryConsole({ activeRun }: TelemetryConsoleProps) {
  const { lang, stepIndex, logs, importRunLog, pushLog } = useLabStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const curStep = activeRun?.steps[Math.min(stepIndex, (activeRun?.steps.length ?? 1) - 1)];
  const peakVram = curStep?.metrics.vram_peak_gb;
  const totalBudget = 8.0;

  const baseGb = 1.0;
  const loraGb = 0.1;
  const sysGb = 1.1;
  const actGb = Math.max(0, (peakVram ?? 0) - baseGb - loraGb - sysGb);

  const pct = (gb: number) => Math.min(100, (gb / totalBudget) * 100);

  const handleExport = () => {
    if (!activeRun) return;
    const blob = new Blob([JSON.stringify(activeRun, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeRun.metadata.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidRunLog(parsed)) {
        pushLog('error', 'Invalid RunLog JSON: missing `metadata` or non-empty `steps` array.');
        return;
      }
      importRunLog(parsed);
    } catch (err) {
      pushLog('error', `Failed to parse JSON: ${String(err)}`);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <Stack gap="sm">
      {/* 8GB VRAM Ledger */}
      <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
        <Group justify="space-between" mb={8} wrap="wrap">
          <Text size="xs" fw={600}>
            {pickText(UI_STRINGS.vramLedgerTitle, lang)}
          </Text>
          <Badge size="xs" color={peakVram !== undefined && peakVram > 6.8 ? 'red' : 'teal'} ff="monospace">
            {pickText(UI_STRINGS.kpiVram, lang)}: {peakVram === undefined ? '—' : `${peakVram.toFixed(2)} GB`}
          </Badge>
        </Group>

        <Progress.Root size={14} radius="xs" mb="sm">
          <Progress.Section value={pct(baseGb)} color="cobalt" />
          <Progress.Section value={pct(loraGb)} color="teal" />
          <Progress.Section value={pct(actGb)} color="orange" />
          <Progress.Section value={pct(sysGb)} color="gray" />
        </Progress.Root>

        <Group gap="md" wrap="wrap">
          <Group gap={6}>
            <Box w={9} h={9} style={{ borderRadius: 2, background: '#1d4ed8' }} />
            <Text size="11px" ff="monospace">
              {pickText(UI_STRINGS.vramBase, lang)}: {baseGb.toFixed(1)} GB
            </Text>
          </Group>
          <Group gap={6}>
            <Box w={9} h={9} style={{ borderRadius: 2, background: '#059669' }} />
            <Text size="11px" ff="monospace">
              {pickText(UI_STRINGS.vramLora, lang)}: {loraGb.toFixed(1)} GB
            </Text>
          </Group>
          <Group gap={6}>
            <Box w={9} h={9} style={{ borderRadius: 2, background: '#0f766e', border: '1px dashed #94a3b8' }} />
            <Text size="11px" ff="monospace">
              {pickText(UI_STRINGS.vramRef, lang)}: 0.0 GB
            </Text>
          </Group>
          <Group gap={6}>
            <Box w={9} h={9} style={{ borderRadius: 2, background: '#d97706' }} />
            <Text size="11px" ff="monospace">
              {pickText(UI_STRINGS.vramAct, lang)}: {actGb.toFixed(2)} GB
            </Text>
          </Group>
          <Group gap={6}>
            <Box w={9} h={9} style={{ borderRadius: 2, background: '#868e96' }} />
            <Text size="11px" ff="monospace">
              {pickText(UI_STRINGS.vramSys, lang)}: {sysGb.toFixed(1)} GB
            </Text>
          </Group>
        </Group>
      </Paper>

      {/* Run JSON Import / Export */}
      <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
        <Group justify="space-between" wrap="wrap" gap={8}>
          <Box>
            <Text size="xs" fw={600}>
              {lang === 'zh' ? '统一实验日志格式 (Schema v1.0)' : 'Unified Run Log Schema (v1.0)'}
            </Text>
            <Text size="11px" c="dimmed">
              {lang === 'zh'
                ? '本地 GPU 跑出的 runs/*.json 可直接拖入网页复盘或替换静态演示数据。'
                : 'Load any `runs/*.json` generated on your home GPU directly into the browser workbench.'}
            </Text>
          </Box>
          <Group gap={8}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<Upload size={12} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {pickText(UI_STRINGS.importJson, lang)}
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<Download size={12} />}
              onClick={handleExport}
              disabled={!activeRun}
            >
              {pickText(UI_STRINGS.exportJson, lang)}
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Execution Console */}
      <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
        <Text size="xs" fw={600} mb={6}>
          {pickText(UI_STRINGS.consoleTitle, lang)}
        </Text>
        <ScrollArea h={230} type="auto">
          <Stack gap={4}>
            {logs.map((entry) => (
              <Group key={entry.id} gap={8} wrap="nowrap" align="flex-start">
                <Text size="11px" ff="monospace" c="dimmed" style={{ flexShrink: 0 }}>
                  {entry.ts}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={
                    entry.level === 'ok'
                      ? 'teal'
                      : entry.level === 'warn'
                        ? 'orange'
                        : entry.level === 'error'
                          ? 'red'
                          : 'gray'
                  }
                  w={46}
                  style={{ flexShrink: 0 }}
                >
                  {entry.level.toUpperCase()}
                </Badge>
                <Text size="11px" ff="monospace" style={{ wordBreak: 'break-word' }}>
                  {entry.message}
                </Text>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
