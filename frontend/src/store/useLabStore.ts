import { create } from 'zustand';
import demoRunsRaw from '../data/demoRuns.json';
import { LESSONS } from '../i18n/lessons';
import type {
  ConsoleEntry,
  DeviceTelemetry,
  DryRunResult,
  Lang,
  RunLog,
  StepLog,
} from '../types/lab';

const DEMO_RUNS = demoRunsRaw as unknown as Record<string, RunLog>;

function detectInitialLang(): Lang {
  const saved = localStorage.getItem('llm-rl-lab-lang');
  if (saved === 'zh' || saved === 'en') return saved;
  return 'zh';
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

interface LabState {
  lang: Lang;
  activeLessonId: string;
  activeTab: string;
  activePresetId: string;
  baselinePresetId: string;
  compareBaseline: boolean;
  speedMode: 'fast' | 'full';
  stepIndex: number;
  isPlaying: boolean;

  // Runs store (demo + imported + live local runs)
  runs: Record<string, RunLog>;
  liveRunId: string | null;
  isTraining: boolean;

  // Local backend connection
  localUrl: string;
  localToken: string;
  localConnected: boolean;
  deviceTelemetry: DeviceTelemetry | null;
  connectModalOpen: boolean;

  // Predict-before-run state per lesson
  predictions: Record<string, { selectedId: string | null; locked: boolean }>;

  // Code editor state per lesson
  codeByLesson: Record<string, string>;
  dryRunByLesson: Record<string, DryRunResult | null>;

  // Console logs
  logs: ConsoleEntry[];

  // Actions
  setLang: (lang: Lang) => void;
  selectLesson: (lessonId: string) => void;
  setActiveTab: (tab: string) => void;
  setActivePreset: (presetId: string) => void;
  setCompareBaseline: (val: boolean) => void;
  setSpeedMode: (mode: 'fast' | 'full') => void;
  setStepIndex: (idx: number) => void;
  setIsPlaying: (val: boolean) => void;
  selectPrediction: (lessonId: string, optionId: string) => void;
  lockPrediction: (lessonId: string, experimentPresetId: string, baselinePresetId: string) => void;
  resetPrediction: (lessonId: string) => void;
  setCodeForLesson: (lessonId: string, code: string) => void;
  setDryRunResult: (lessonId: string, res: DryRunResult | null) => void;
  setConnectModalOpen: (open: boolean) => void;
  setLocalConnection: (url: string, token: string, device: DeviceTelemetry | null) => void;
  disconnectLocal: () => void;
  startLiveRun: (metadata: RunLog['metadata']) => void;
  appendLiveStep: (step: StepLog) => void;
  finishLiveRun: () => void;
  importRunLog: (run: RunLog) => void;
  pushLog: (level: ConsoleEntry['level'], message: string) => void;
}

const initialCodeMap: Record<string, string> = {};
for (const l of LESSONS) {
  initialCodeMap[l.id] = l.starterCode;
}

const initialUrlParams = new URLSearchParams(window.location.search);
const urlToken = initialUrlParams.get('token') || '';

export const useLabStore = create<LabState>((set, get) => ({
  lang: detectInitialLang(),
  activeLessonId: LESSONS[0].id,
  activeTab: 'dashboard',
  activePresetId: LESSONS[0].defaultPresetId,
  baselinePresetId: LESSONS[0].baselinePresetId,
  compareBaseline: true,
  speedMode: 'fast',
  stepIndex: Math.max(0, (DEMO_RUNS[LESSONS[0].defaultPresetId]?.steps.length ?? 1) - 1),
  isPlaying: false,

  runs: { ...DEMO_RUNS },
  liveRunId: null,
  isTraining: false,

  localUrl:
    urlToken && window.location.port !== '5173'
      ? window.location.origin
      : 'http://127.0.0.1:8765',
  localToken: urlToken,
  localConnected: false,
  deviceTelemetry: null,
  connectModalOpen: false,

  predictions: {},
  codeByLesson: initialCodeMap,
  dryRunByLesson: {},
  logs: [
    {
      id: 'init-1',
      ts: nowTime(),
      level: 'info',
      message: 'Loaded 10 pre-recorded Countdown RLVR runs (Qwen2.5-0.5B-Instruct · 8 GB VRAM schema v1.0).',
    },
  ],

  setLang: (lang) => {
    localStorage.setItem('llm-rl-lab-lang', lang);
    set({ lang });
  },

  selectLesson: (lessonId) => {
    const lesson = LESSONS.find((l) => l.id === lessonId);
    if (!lesson) return;
    const run = get().runs[lesson.defaultPresetId];
    set({
      activeLessonId: lessonId,
      activePresetId: lesson.defaultPresetId,
      baselinePresetId: lesson.baselinePresetId,
      liveRunId: null,
      isPlaying: false,
      stepIndex: run ? Math.max(0, run.steps.length - 1) : 0,
    });
  },

  setActiveTab: (activeTab) => set({ activeTab }),

  setActivePreset: (presetId) => {
    const run = get().runs[presetId];
    set({
      activePresetId: presetId,
      liveRunId: null,
      isPlaying: false,
      stepIndex: run ? Math.min(get().stepIndex, Math.max(0, run.steps.length - 1)) : 0,
    });
  },

  setCompareBaseline: (compareBaseline) => set({ compareBaseline }),
  setSpeedMode: (speedMode) => set({ speedMode }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  selectPrediction: (lessonId, optionId) =>
    set((s) => ({
      predictions: {
        ...s.predictions,
        [lessonId]: { selectedId: optionId, locked: s.predictions[lessonId]?.locked ?? false },
      },
    })),

  lockPrediction: (lessonId, experimentPresetId, baselinePresetId) => {
    const run = get().runs[experimentPresetId];
    set((s) => ({
      predictions: {
        ...s.predictions,
        [lessonId]: {
          selectedId: s.predictions[lessonId]?.selectedId ?? null,
          locked: true,
        },
      },
      activePresetId: experimentPresetId,
      baselinePresetId,
      compareBaseline: true,
      liveRunId: null,
      activeTab: 'dashboard',
      stepIndex: run ? Math.max(0, run.steps.length - 1) : 0,
    }));
  },

  resetPrediction: (lessonId) =>
    set((s) => ({
      predictions: {
        ...s.predictions,
        [lessonId]: { selectedId: null, locked: false },
      },
    })),

  setCodeForLesson: (lessonId, code) =>
    set((s) => ({
      codeByLesson: { ...s.codeByLesson, [lessonId]: code },
    })),

  setDryRunResult: (lessonId, res) =>
    set((s) => ({
      dryRunByLesson: { ...s.dryRunByLesson, [lessonId]: res },
    })),

  setConnectModalOpen: (connectModalOpen) => set({ connectModalOpen }),

  setLocalConnection: (localUrl, localToken, deviceTelemetry) =>
    set((s) => ({
      localUrl,
      localToken,
      deviceTelemetry,
      localConnected: Boolean(deviceTelemetry),
      logs: [
        ...s.logs.slice(-80),
        {
          id: `conn-${Date.now()}`,
          ts: nowTime(),
          level: 'ok',
          message: deviceTelemetry
            ? `Connected to ${localUrl} (${deviceTelemetry.device_name}, ${deviceTelemetry.recommended_dtype})`
            : 'Disconnected from local server.',
        },
      ],
    })),

  disconnectLocal: () =>
    set({
      localConnected: false,
      deviceTelemetry: null,
      isTraining: false,
    }),

  startLiveRun: (metadata) => {
    const liveRun: RunLog = {
      schema_version: '1.0.0',
      metadata,
      steps: [],
    };
    set((s) => ({
      runs: { ...s.runs, [metadata.run_id]: liveRun },
      liveRunId: metadata.run_id,
      activePresetId: metadata.run_id,
      isTraining: true,
      isPlaying: false,
      stepIndex: 0,
    }));
  },

  appendLiveStep: (step) =>
    set((s) => {
      const id = s.liveRunId;
      if (!id || !s.runs[id]) return s;
      const prev = s.runs[id];
      const nextSteps = [...prev.steps, step];
      return {
        runs: {
          ...s.runs,
          [id]: { ...prev, steps: nextSteps },
        },
        stepIndex: nextSteps.length - 1,
      };
    }),

  finishLiveRun: () =>
    set((s) => ({
      isTraining: false,
      logs: [
        ...s.logs.slice(-80),
        { id: `fin-${Date.now()}`, ts: nowTime(), level: 'ok', message: 'Local training run completed.' },
      ],
    })),

  importRunLog: (run) => {
    const id = run.metadata.run_id || `imported-${Date.now()}`;
    set((s) => ({
      runs: { ...s.runs, [id]: run },
      activePresetId: id,
      liveRunId: null,
      stepIndex: Math.max(0, run.steps.length - 1),
      logs: [
        ...s.logs.slice(-80),
        {
          id: `imp-${Date.now()}`,
          ts: nowTime(),
          level: 'ok',
          message: `Imported run "${id}" (${run.steps.length} steps, ${run.metadata.model_name}).`,
        },
      ],
    }));
  },

  pushLog: (level, message) =>
    set((s) => ({
      logs: [...s.logs.slice(-80), { id: `log-${Date.now()}-${Math.random()}`, ts: nowTime(), level, message }],
    })),
}));
