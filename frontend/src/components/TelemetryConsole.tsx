import { useRef } from 'react';
import { Box, Button, Group, Progress, ScrollArea, Stack, Text } from '@mantine/core';
import { Download, Upload } from 'reicon-react';
import { isValidRunLog } from '../api/client';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { RunLog } from '../types/lab';
import { LabIcon } from './LabIcon';

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
    <Stack gap={32}>
      {/* Section 1: 8 GB VRAM Ledger (flat neutral surface, single accent bar) */}
      <Box p={24} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
        <Group justify="space-between" mb={16} wrap="wrap">
          <Text fz={18} fw={600} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.vramLedgerTitle, lang)}
          </Text>
          <Text fz={16} fw={600} ff="monospace" className="tabular-nums" style={{ color: 'var(--lab-accent)' }}>
            {peakVram === undefined ? '—' : `${peakVram.toFixed(2)} / ${totalBudget.toFixed(1)} GB`}
          </Text>
        </Group>

        <Progress.Root size={12} radius="sm" mb={20}>
          <Progress.Section value={pct(baseGb)} color="accent" />
          <Progress.Section value={pct(loraGb)} color="dark.4" />
          <Progress.Section value={pct(actGb)} color="gray.6" />
          <Progress.Section value={pct(sysGb)} color="gray.4" />
        </Progress.Root>

        <Group gap={24} wrap="wrap">
          <Text fz={14} ff="monospace" style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.vramBase, lang)} {baseGb.toFixed(1)} GB
          </Text>
          <Text fz={14} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
            {pickText(UI_STRINGS.vramLora, lang)} {loraGb.toFixed(1)} GB
          </Text>
          <Text fz={14} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
            {pickText(UI_STRINGS.vramRef, lang)} 0.0 GB
          </Text>
          <Text fz={14} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
            {pickText(UI_STRINGS.vramAct, lang)} {actGb.toFixed(2)} GB
          </Text>
          <Text fz={14} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
            {pickText(UI_STRINGS.vramSys, lang)} {sysGb.toFixed(1)} GB
          </Text>
        </Group>
      </Box>

      {/* Section 2: Execution Log with intent-revealed Import/Export actions */}
      <Box className="intent-zone" p={24} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
        <Group justify="space-between" mb={16} wrap="wrap" gap={12}>
          <Text fz={18} fw={600} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.consoleTitle, lang)}
          </Text>

          <Group gap={8} className="intent-controls">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<LabIcon icon={Upload} color="var(--lab-muted)" />}
              onClick={() => fileInputRef.current?.click()}
              styles={{ root: { height: 36, fontWeight: 500, color: 'var(--lab-text)' } }}
            >
              {pickText(UI_STRINGS.importJson, lang)}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<LabIcon icon={Download} color="var(--lab-muted)" />}
              onClick={handleExport}
              disabled={!activeRun}
              styles={{ root: { height: 36, fontWeight: 500, color: 'var(--lab-text)' } }}
            >
              {pickText(UI_STRINGS.exportJson, lang)}
            </Button>
          </Group>
        </Group>

        <ScrollArea h={240} type="auto">
          <Stack gap={8}>
            {logs.map((entry) => (
              <Group key={entry.id} gap={12} wrap="nowrap" align="flex-start">
                <Text fz={13} ff="monospace" style={{ color: 'var(--lab-muted)', flexShrink: 0 }}>
                  {entry.ts}
                </Text>
                <Text
                  fz={13}
                  fw={600}
                  ff="monospace"
                  w={48}
                  style={{
                    color: entry.level === 'ok' ? 'var(--lab-accent)' : 'var(--lab-muted)',
                    flexShrink: 0,
                  }}
                >
                  {entry.level.toUpperCase()}
                </Text>
                <Text fz={13} ff="monospace" style={{ color: 'var(--lab-text)', wordBreak: 'break-word' }}>
                  {entry.message}
                </Text>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      </Box>
    </Stack>
  );
}
