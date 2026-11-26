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
import { Activity, Code, Cpu, Microscope, Pause, Play, Stop } from 'reicon-react';
import { postStartTrain, postStopTrain } from '../api/client';
import { pickText, PRESET_LABELS, UI_STRINGS } from '../i18n';
import { LESSONS } from '../i18n/lessons';
import { useLabStore } from '../store/useLabStore';
import type { RunLog } from '../types/lab';
import { CodeSurgeryTab } from './CodeSurgeryTab';
import { LabIcon } from './LabIcon';
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

  const sourceLabel = (run?: RunLog) => {
    const mock = run?.metadata.is_mock;
    return pickText(
      mock === true ? UI_STRINGS.mockData : mock === false ? UI_STRINGS.gpuData : UI_STRINGS.unknownSource,
      lang
    );
  };

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
      {/* Borderless Experiment Control Strip (single row, 4px grid, 90:10 accent discipline) */}
      <Box px={24} pt={12} pb={8} style={{ flexShrink: 0 }}>
        <Group justify="space-between" gap={12} wrap="nowrap" mb={12}>
          <Group gap={12} wrap="nowrap" style={{ minWidth: 0 }}>
            <Select
              size="sm"
              w={224}
              value={activePresetId}
              onChange={(v) => v && setActivePreset(v)}
              data={presetOptions}
              aria-label={pickText(UI_STRINGS.presetLabel, lang)}
              styles={{
                input: {
                  backgroundColor: 'var(--lab-surface)',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                },
              }}
            />
            <Text fz={13} style={{ color: 'var(--lab-muted)', whiteSpace: 'nowrap' }}>
              {sourceLabel(activeRun)}
            </Text>
            <Switch
              size="xs"
              color="dark"
              checked={compareBaseline}
              onChange={(e) => setCompareBaseline(e.currentTarget.checked)}
              label={
                <Text fz={13} style={{ color: 'var(--lab-muted)', whiteSpace: 'nowrap' }}>
                  {pickText(UI_STRINGS.compareBaseline, lang)}
                </Text>
              }
            />
          </Group>

          <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
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
              size="sm"
              color={isTraining ? 'dark' : 'accent'}
              leftSection={
                <LabIcon
                  icon={
                    localConnected
                      ? isTraining
                        ? Stop
                        : Play
                      : isPlaying
                        ? Pause
                        : Play
                  }
                  color="#ffffff"
                />
              }
              onClick={handleTogglePlayOrTrain}
              px={16}
              styles={{ root: { height: 36, fontWeight: 500 } }}
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

        {/* Synchronized Step Scrubber (neutral dark bar so only primary CTA & data use accent) */}
        <Group gap={16} align="center" wrap="nowrap">
          <Text fz={13} ff="monospace" className="tabular-nums" miw={84} style={{ color: 'var(--lab-muted)' }}>
            {pickText(UI_STRINGS.stepLabel, lang)} {currentStepLog?.step ?? 0}
          </Text>
          <Slider
            style={{ flex: 1 }}
            size="xs"
            color="dark"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={clampedIdx}
            onChange={(val) => {
              setIsPlaying(false);
              setStepIndex(val);
            }}
            label={(idx) => `Step ${activeRun?.steps[idx]?.step ?? idx}`}
          />
          <Text fz={13} ff="monospace" className="tabular-nums" miw={56} ta="right" style={{ color: 'var(--lab-muted)' }}>
            {clampedIdx + 1} / {totalSteps}
          </Text>
        </Group>
      </Box>

      {/* Clean Minimal Neutral Tabs (active state uses neutral surface, not blue slab) */}
      <Tabs
        value={activeTab}
        onChange={(v) => v && setActiveTab(v)}
        variant="pills"
        radius="sm"
        className="lab-tabs"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Tabs.List px={24} py={8} style={{ gap: 8, flexShrink: 0 }}>
          <Tabs.Tab value="dashboard" leftSection={<LabIcon icon={Activity} />}>
            <Text fz={14} fw={activeTab === 'dashboard' ? 600 : 400}>
              {pickText(UI_STRINGS.tabDashboard, lang)}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="microscope" leftSection={<LabIcon icon={Microscope} />}>
            <Text fz={14} fw={activeTab === 'microscope' ? 600 : 400}>
              {pickText(UI_STRINGS.tabMicroscope, lang)}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="code" leftSection={<LabIcon icon={Code} />}>
            <Text fz={14} fw={activeTab === 'code' ? 600 : 400}>
              {pickText(UI_STRINGS.tabCode, lang)}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="console" leftSection={<LabIcon icon={Cpu} />}>
            <Text fz={14} fw={activeTab === 'console' ? 600 : 400}>
              {pickText(UI_STRINGS.tabConsole, lang)}
            </Text>
          </Tabs.Tab>
        </Tabs.List>

        <ScrollArea style={{ flex: 1 }} px={24} py={20} offsetScrollbars>
          <Tabs.Panel value="dashboard">
            {activeTab === 'dashboard' && (
              <MetricsDashboard activeRun={activeRun} baselineRun={baselineRun} />
            )}
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
