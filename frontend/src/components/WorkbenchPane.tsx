import {
  Box,
  Button,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  Tabs,
  Text,
} from '@mantine/core';
import { Activity, Code2, Cpu, Microscope, Pause, Play, Square } from 'lucide-react';
import { postStartTrain, postStopTrain } from '../api/client';
import { pickText, PRESET_LABELS, UI_STRINGS } from '../i18n';
import { LESSONS } from '../i18n/lessons';
import { useLabStore } from '../store/useLabStore';
import { CodeSurgeryTab } from './CodeSurgeryTab';
import { MetricsDashboard } from './MetricsDashboard';
import { RolloutMicroscope } from './RolloutMicroscope';
import { TelemetryConsole } from './TelemetryConsole';

export function WorkbenchPane() {
  const {
    lang,
    activeLessonId,
    activeTab,
    setActiveTab,
    activePresetId,
    setActivePreset,
    baselinePresetId,
    compareBaseline,
    setCompareBaseline,
    speedMode,
    setSpeedMode,
    stepIndex,
    setStepIndex,
    isPlaying,
    setIsPlaying,
    runs,
    localConnected,
    localUrl,
    localToken,
    isTraining,
    codeByLesson,
    pushLog,
  } = useLabStore();

  const lesson = LESSONS.find((l) => l.id === activeLessonId) ?? LESSONS[0];
  const activeRun = runs[activePresetId];
  const baselineRun = runs[baselinePresetId];
  const totalSteps = activeRun?.steps.length ?? 1;
  const clampedIdx = Math.min(stepIndex, Math.max(0, totalSteps - 1));
  const currentStepLog = activeRun?.steps[clampedIdx];

  // Build preset dropdown options (all demo presets + any imported/live runs)
  const presetOptions = Object.keys(runs).map((id) => ({
    value: id,
    label: PRESET_LABELS[id] ? pickText(PRESET_LABELS[id], lang) : `Custom · ${id}`,
  }));

  const handleTogglePlayOrTrain = async () => {
    if (localConnected) {
      if (isTraining) {
        await postStopTrain({ baseUrl: localUrl, token: localToken });
        pushLog('warn', 'Requested stop for active local training run.');
      } else {
        try {
          const presetForBackend = PRESET_LABELS[activePresetId] ? activePresetId : lesson.defaultPresetId;
          await postStartTrain(
            { baseUrl: localUrl, token: localToken },
            {
              preset_id: presetForBackend,
              lesson_id: lesson.id,
              speed_mode: speedMode,
              custom_code: codeByLesson[lesson.id],
            }
          );
          pushLog('info', `Started local training: preset=${presetForBackend}, mode=${speedMode}`);
        } catch (err) {
          pushLog('error', `Failed to start local training: ${String(err)}`);
        }
      }
      return;
    }

    // Static Replay mode: toggle timeline playback
    if (!isPlaying && clampedIdx >= totalSteps - 1) {
      setStepIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Box
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--lab-bg)',
      }}
    >
      {/* Persistent Experiment Control Strip */}
      <Box
        px="md"
        py={8}
        style={{
          backgroundColor: 'var(--lab-surface)',
          borderBottom: '1px solid var(--lab-border)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" gap={8} wrap="wrap" mb={8}>
          <Group gap={8} wrap="wrap">
            <Select
              size="xs"
              w={265}
              value={activePresetId}
              onChange={(v) => v && setActivePreset(v)}
              data={presetOptions}
              aria-label={pickText(UI_STRINGS.presetLabel, lang)}
            />
            <Switch
              size="xs"
              checked={compareBaseline}
              onChange={(e) => setCompareBaseline(e.currentTarget.checked)}
              label={
                <Text size="xs">{pickText(UI_STRINGS.compareBaseline, lang)}</Text>
              }
            />
          </Group>

          <Group gap={8} wrap="nowrap">
            {localConnected && (
              <SegmentedControl
                size="xs"
                value={speedMode}
                onChange={(v) => setSpeedMode(v as 'fast' | 'full')}
                data={[
                  { label: pickText(UI_STRINGS.speedFast, lang), value: 'fast' },
                  { label: pickText(UI_STRINGS.speedFull, lang), value: 'full' },
                ]}
              />
            )}
            <Button
              size="compact-xs"
              color={isTraining ? 'red' : 'cobalt'}
              leftSection={
                localConnected ? (
                  isTraining ? (
                    <Square size={12} />
                  ) : (
                    <Play size={12} />
                  )
                ) : isPlaying ? (
                  <Pause size={12} />
                ) : (
                  <Play size={12} />
                )
              }
              onClick={handleTogglePlayOrTrain}
            >
              {localConnected
                ? isTraining
                  ? pickText(UI_STRINGS.stopGpu, lang)
                  : pickText(UI_STRINGS.runGpu, lang)
                : isPlaying
                  ? pickText(UI_STRINGS.pauseReplay, lang)
                  : pickText(UI_STRINGS.playReplay, lang)}
            </Button>
          </Group>
        </Group>

        {/* Synchronized Step Scrubber */}
        <Group gap="sm" align="center" wrap="nowrap">
          <Text size="11px" ff="monospace" c="dimmed" className="tabular-nums" miw={84}>
            {pickText(UI_STRINGS.stepLabel, lang)} {currentStepLog?.step ?? 0}
          </Text>
          <Slider
            style={{ flex: 1 }}
            size="xs"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={clampedIdx}
            onChange={(val) => {
              setIsPlaying(false);
              setStepIndex(val);
            }}
            label={(idx) => `Step ${activeRun?.steps[idx]?.step ?? idx}`}
          />
          <Text size="11px" ff="monospace" c="dimmed" className="tabular-nums" miw={52} ta="right">
            {clampedIdx + 1} / {totalSteps}
          </Text>
        </Group>
      </Box>

      {/* Workbench Tabs */}
      <Tabs
        value={activeTab}
        onChange={(v) => v && setActiveTab(v)}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Tabs.List
          px="md"
          style={{
            backgroundColor: 'var(--lab-surface)',
            borderBottom: '1px solid var(--lab-border)',
            flexShrink: 0,
          }}
        >
          <Tabs.Tab value="dashboard" leftSection={<Activity size={14} />}>
            <Text size="xs" fw={500}>
              {pickText(UI_STRINGS.tabDashboard, lang)}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="microscope" leftSection={<Microscope size={14} />}>
            <Text size="xs" fw={500}>
              {pickText(UI_STRINGS.tabMicroscope, lang)}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="code" leftSection={<Code2 size={14} />}>
            <Text size="xs" fw={500}>
              {pickText(UI_STRINGS.tabCode, lang)}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="console" leftSection={<Cpu size={14} />}>
            <Text size="xs" fw={500}>
              {pickText(UI_STRINGS.tabConsole, lang)}
            </Text>
          </Tabs.Tab>
        </Tabs.List>

        <ScrollArea style={{ flex: 1 }} p="md" offsetScrollbars>
          <Tabs.Panel value="dashboard">
            <MetricsDashboard activeRun={activeRun} baselineRun={baselineRun} />
          </Tabs.Panel>
          <Tabs.Panel value="microscope">
            <RolloutMicroscope stepLog={currentStepLog} />
          </Tabs.Panel>
          <Tabs.Panel value="code">
            <CodeSurgeryTab lesson={lesson} />
          </Tabs.Panel>
          <Tabs.Panel value="console">
            <TelemetryConsole activeRun={activeRun} />
          </Tabs.Panel>
        </ScrollArea>
      </Tabs>
    </Box>
  );
}
