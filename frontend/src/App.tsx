import { useEffect, useRef } from 'react';
import { Box } from '@mantine/core';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { fetchLocalDevice, openTrainWebSocket } from './api/client';
import { HeaderBar } from './components/HeaderBar';
import { LessonPane } from './components/LessonPane';
import { LocalConnectModal } from './components/LocalConnectModal';
import { WorkbenchPane } from './components/WorkbenchPane';
import { useLabStore } from './store/useLabStore';
import type { RunLog, StepLog } from './types/lab';

export function App() {
  const {
    isPlaying,
    setIsPlaying,
    stepIndex,
    setStepIndex,
    activePresetId,
    runs,
    localConnected,
    localUrl,
    localToken,
    setLocalConnection,
    disconnectLocal,
    startLiveRun,
    appendLiveStep,
    finishLiveRun,
    pushLog,
  } = useLabStore();

  const wsRef = useRef<WebSocket | null>(null);

  // Auto-connect if launched via `llm-rl-lab serve` with ?token=... in URL
  useEffect(() => {
    if (localToken && !localConnected) {
      fetchLocalDevice({ baseUrl: localUrl, token: localToken })
        .then((dev) => setLocalConnection(localUrl, localToken, dev))
        .catch(() => {
          // Stay silently in Static Replay mode
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manage WebSocket stream whenever local backend is connected
  useEffect(() => {
    if (!localConnected || !localToken) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const ws = openTrainWebSocket(
      { baseUrl: localUrl, token: localToken },
      (ev) => {
        if (ev.type === 'run_started' && ev.metadata) {
          startLiveRun(ev.metadata as RunLog['metadata']);
        } else if (ev.type === 'step' && ev.step) {
          appendLiveStep(ev.step as StepLog);
        } else if (ev.type === 'run_finished') {
          finishLiveRun();
        } else if (ev.type === 'log' && typeof ev.message === 'string') {
          const lvl = ev.level === 'warn' || ev.level === 'error' ? ev.level : 'info';
          pushLog(lvl, ev.message);
        } else if (ev.type === 'error' && typeof ev.message === 'string') {
          pushLog('error', ev.message);
          finishLiveRun();
        }
      },
      () => {
        disconnectLocal();
      }
    );
    wsRef.current = ws;
    return () => {
      ws.close();
    };
  }, [
    localConnected,
    localUrl,
    localToken,
    startLiveRun,
    appendLiveStep,
    finishLiveRun,
    pushLog,
    disconnectLocal,
  ]);

  // Static replay autoplay timer
  useEffect(() => {
    if (!isPlaying) return;
    const total = runs[activePresetId]?.steps.length ?? 0;
    if (total <= 1) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      const cur = useLabStore.getState().stepIndex;
      if (cur >= total - 1) {
        setIsPlaying(false);
      } else {
        setStepIndex(cur + 1);
      }
    }, 220);
    return () => window.clearInterval(timer);
  }, [isPlaying, activePresetId, runs, setIsPlaying, setStepIndex, stepIndex]);

  return (
    <Box
      h="100vh"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <HeaderBar />
      <Box style={{ flex: 1, minHeight: 0 }}>
        <PanelGroup direction="horizontal" autoSaveId="llm-rl-lab-split">
          <Panel defaultSize={41} minSize={28} maxSize={62}>
            <LessonPane />
          </Panel>
          <PanelResizeHandle className="lab-resize-handle" />
          <Panel defaultSize={59} minSize={38}>
            <WorkbenchPane />
          </Panel>
        </PanelGroup>
      </Box>
      <LocalConnectModal />
    </Box>
  );
}

export default App;
