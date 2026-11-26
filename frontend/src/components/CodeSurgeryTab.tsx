import { useState } from 'react';
import {
  Box,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  useComputedColorScheme,
} from '@mantine/core';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { CheckCircle, CloseCircle, Code, Play, Refresh } from 'reicon-react';
import { browserDryRunCheck, postDryRun } from '../api/client';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { LessonDefinition } from '../types/lab';
import { LabIcon } from './LabIcon';

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
    <Stack gap={24} className="intent-zone">
      {/* Borderless Toolbar: Primary Dry-Run visible, secondary actions reveal on intent */}
      <Group justify="space-between" wrap="wrap" gap={12}>
        <Group gap={16}>
          <Text fz={14} fw={600} ff="monospace" style={{ color: 'var(--lab-text)' }}>
            {lesson.codeFileName}
          </Text>
          <Box className="intent-controls">
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => setViewMode(v as 'edit' | 'diff')}
              data={[
                { label: pickText(UI_STRINGS.codeModeEdit, lang), value: 'edit' },
                { label: pickText(UI_STRINGS.codeModeDiff, lang), value: 'diff' },
              ]}
            />
          </Box>
        </Group>

        <Group gap={8}>
          <Group gap={8} className="intent-controls">
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<LabIcon icon={Code} color="var(--lab-muted)" />}
              onClick={() => {
                setCodeForLesson(lesson.id, lesson.experimentDiffCode);
                setViewMode('edit');
              }}
              styles={{ root: { height: 36, fontWeight: 500, color: 'var(--lab-text)' } }}
            >
              {pickText(UI_STRINGS.applyDiffBtn, lang)}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<LabIcon icon={Refresh} color="var(--lab-muted)" />}
              onClick={() => {
                setCodeForLesson(lesson.id, lesson.starterCode);
                setDryRunResult(lesson.id, null);
              }}
              styles={{ root: { height: 36, fontWeight: 500, color: 'var(--lab-text)' } }}
            >
              {pickText(UI_STRINGS.resetCodeBtn, lang)}
            </Button>
          </Group>

          <Button
            size="sm"
            loading={checking}
            leftSection={<LabIcon icon={Play} color="#ffffff" />}
            onClick={handleDryRun}
            styles={{ root: { height: 36, fontWeight: 500 } }}
          >
            {pickText(UI_STRINGS.dryRunBtn, lang)}
          </Button>
        </Group>
      </Group>

      {/* Single flat rounded Monaco surface (no outer border or nested card) */}
      <Box
        h={368}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: 'var(--lab-surface)',
        }}
      >
        {viewMode === 'edit' ? (
          <Editor
            height="368px"
            language="python"
            theme={scheme === 'dark' ? 'vs-dark' : 'vs'}
            value={code}
            onChange={(val) => setCodeForLesson(lesson.id, val ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: 24,
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              renderLineHighlight: 'none',
              tabSize: 4,
            }}
          />
        ) : (
          <DiffEditor
            height="368px"
            language="python"
            theme={scheme === 'dark' ? 'vs-dark' : 'vs'}
            original={lesson.starterCode}
            modified={lesson.experimentDiffCode}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              renderSideBySide: true,
              scrollBeyondLastLine: false,
            }}
          />
        )}
      </Box>

      {/* Dry-Run Diagnostics (only rendered after running — no idle explanatory text) */}
      {dryRun && (
        <Box p={20} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 16 }}>
          <Group justify="space-between" mb={12}>
            <Group gap={8}>
              <LabIcon
                icon={dryRun.ok ? CheckCircle : CloseCircle}
                color={dryRun.ok ? 'var(--lab-accent)' : 'var(--lab-text)'}
              />
              <Text fz={14} fw={600} style={{ color: 'var(--lab-text)' }}>
                {dryRun.summary}
              </Text>
            </Group>
            <Text fz={13} ff="monospace" style={{ color: 'var(--lab-muted)' }}>
              {dryRun.backend} · {dryRun.elapsed_ms} ms
            </Text>
          </Group>

          <Stack gap={8}>
            {dryRun.checks.map((c, idx) => (
              <Group key={idx} gap={16} wrap="nowrap">
                <Text
                  fz={13}
                  fw={600}
                  ff="monospace"
                  w={48}
                  style={{ color: c.passed ? 'var(--lab-accent)' : 'var(--lab-text)' }}
                >
                  {c.passed ? 'PASS' : 'FAIL'}
                </Text>
                <Text fz={13} ff="monospace" fw={500} miw={140} style={{ color: 'var(--lab-text)' }}>
                  {c.name}
                </Text>
                <Text fz={14} style={{ color: 'var(--lab-muted)' }}>
                  {c.detail}
                </Text>
              </Group>
            ))}
            {dryRun.error_line && (
              <Text fz={13} ff="monospace" mt={8} style={{ color: 'var(--lab-text)' }}>
                Line {dryRun.error_line}: {dryRun.error_detail}
              </Text>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
