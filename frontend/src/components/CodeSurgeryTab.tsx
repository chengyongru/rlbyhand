import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  useComputedColorScheme,
} from '@mantine/core';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { CheckCircle2, FileDiff, Play, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { browserDryRunCheck, postDryRun } from '../api/client';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { LessonDefinition } from '../types/lab';

interface CodeSurgeryTabProps {
  lesson: LessonDefinition;
}

export function CodeSurgeryTab({ lesson }: CodeSurgeryTabProps) {
  const {
    lang,
    codeByLesson,
    setCodeForLesson,
    dryRunByLesson,
    setDryRunResult,
    localConnected,
    localUrl,
    localToken,
    pushLog,
  } = useLabStore();

  const scheme = useComputedColorScheme('light');
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');
  const [checking, setChecking] = useState(false);

  const code = codeByLesson[lesson.id] ?? lesson.starterCode;
  const dryRun = dryRunByLesson[lesson.id] ?? null;

  const handleDryRun = async () => {
    setChecking(true);
    try {
      if (localConnected) {
        const res = await postDryRun({ baseUrl: localUrl, token: localToken }, lesson.id, code);
        setDryRunResult(lesson.id, res);
        pushLog(res.ok ? 'ok' : 'error', `[Dry-Run ${res.backend}] ${res.summary} (${res.elapsed_ms}ms)`);
      } else {
        const res = browserDryRunCheck(lesson.id, code);
        setDryRunResult(lesson.id, res);
        pushLog(res.ok ? 'ok' : 'warn', `[Dry-Run browser] ${res.summary}`);
      }
    } catch (err) {
      pushLog('error', `Dry-run failed: ${String(err)}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Stack gap="sm">
      {/* Toolbar */}
      <Paper p="xs" style={{ backgroundColor: 'var(--lab-surface)' }}>
        <Group justify="space-between" wrap="wrap" gap={8}>
          <Group gap={8}>
            <Badge
              size="sm"
              color="gray"
              variant="outline"
              style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
            >
              {lesson.codeFileName}
            </Badge>
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => setViewMode(v as 'edit' | 'diff')}
              data={[
                { label: pickText(UI_STRINGS.codeModeEdit, lang), value: 'edit' },
                { label: pickText(UI_STRINGS.codeModeDiff, lang), value: 'diff' },
              ]}
            />
          </Group>

          <Group gap={6}>
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<FileDiff size={12} />}
              onClick={() => {
                setCodeForLesson(lesson.id, lesson.experimentDiffCode);
                setViewMode('edit');
              }}
            >
              {pickText(UI_STRINGS.applyDiffBtn, lang)}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<RotateCcw size={12} />}
              onClick={() => {
                setCodeForLesson(lesson.id, lesson.starterCode);
                setDryRunResult(lesson.id, null);
              }}
            >
              {pickText(UI_STRINGS.resetCodeBtn, lang)}
            </Button>
            <Button
              size="compact-xs"
              loading={checking}
              leftSection={<Play size={12} />}
              onClick={handleDryRun}
            >
              {pickText(UI_STRINGS.dryRunBtn, lang)}
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Monaco Editor / Diff Editor */}
      <Paper
        style={{
          overflow: 'hidden',
          borderColor: 'var(--lab-border)',
          backgroundColor: 'var(--lab-surface)',
        }}
      >
        <Box h={340}>
          {viewMode === 'edit' ? (
            <Editor
              height="340px"
              language="python"
              theme={scheme === 'dark' ? 'vs-dark' : 'vs'}
              value={code}
              onChange={(val) => setCodeForLesson(lesson.id, val ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                lineHeight: 21,
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'line',
                tabSize: 4,
              }}
            />
          ) : (
            <DiffEditor
              height="340px"
              language="python"
              theme={scheme === 'dark' ? 'vs-dark' : 'vs'}
              original={lesson.starterCode}
              modified={lesson.experimentDiffCode}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12.5,
                fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                renderSideBySide: true,
                scrollBeyondLastLine: false,
              }}
            />
          )}
        </Box>
      </Paper>

      {/* Dry-Run Diagnostics */}
      {!dryRun ? (
        <Alert color="gray" variant="light" icon={<ShieldCheck size={15} />}>
          <Text size="xs">{pickText(UI_STRINGS.dryRunIdle, lang)}</Text>
        </Alert>
      ) : (
        <Paper p="sm" style={{ backgroundColor: 'var(--lab-surface)' }}>
          <Group justify="space-between" mb={8}>
            <Group gap={6}>
              {dryRun.ok ? (
                <CheckCircle2 size={15} style={{ color: '#059669' }} />
              ) : (
                <XCircle size={15} style={{ color: '#dc2626' }} />
              )}
              <Text size="xs" fw={600}>
                {dryRun.summary}
              </Text>
            </Group>
            <Group gap={6}>
              <Badge size="xs" color="gray" variant="outline" ff="monospace">
                {dryRun.backend}
              </Badge>
              <Badge size="xs" color="gray" variant="light" ff="monospace">
                {dryRun.elapsed_ms} ms
              </Badge>
            </Group>
          </Group>

          <Stack gap={4}>
            {dryRun.checks.map((c, idx) => (
              <Group key={idx} gap={8} wrap="nowrap">
                <Badge size="xs" color={c.passed ? 'teal' : 'red'} variant="light" w={64}>
                  {c.passed ? 'PASS' : 'FAIL'}
                </Badge>
                <Text size="xs" ff="monospace" fw={600} miw={130}>
                  {c.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {c.detail}
                </Text>
              </Group>
            ))}
            {dryRun.error_line && (
              <Text size="xs" c="red" ff="monospace" mt={4}>
                Line {dryRun.error_line}: {dryRun.error_detail}
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
