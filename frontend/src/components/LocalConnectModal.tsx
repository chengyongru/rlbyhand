import { useState } from 'react';
import { Box, Button, Code, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { CheckCircle, Cpu } from 'reicon-react';
import { fetchLocalDevice } from '../api/client';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import { LabIcon } from './LabIcon';

export function LocalConnectModal() {
  const {
    lang,
    connectModalOpen,
    setConnectModalOpen,
    localUrl,
    localToken,
    localConnected,
    deviceTelemetry,
    setLocalConnection,
    disconnectLocal,
  } = useLabStore();

  const [url, setUrl] = useState(localUrl);
  const [token, setToken] = useState(localToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const device = await fetchLocalDevice({ baseUrl: url, token });
      setLocalConnection(url, token, device);
      setConnectModalOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={connectModalOpen}
      onClose={() => setConnectModalOpen(false)}
      radius="xl"
      padding={24}
      title={
        <Group gap={8}>
          <LabIcon icon={Cpu} color="var(--lab-accent)" />
          <Text fw={600} fz={18} style={{ color: 'var(--lab-text)' }}>
            {pickText(UI_STRINGS.modalTitle, lang)}
          </Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap={20}>
        <Box p={16} style={{ backgroundColor: 'var(--lab-surface)', borderRadius: 12 }}>
          <Stack gap={12}>
            <Text fz={14} fw={600} style={{ color: 'var(--lab-text)' }}>
              {lang === 'zh' ? '8 GB GPU' : '8 GB GPU'}
            </Text>
            <Code block style={{ backgroundColor: 'var(--lab-bg)', borderRadius: 8, padding: 12 }}>
              {`uv sync --extra gpu\nuv run llm-rl-lab serve`}
            </Code>
            <Text fz={14} fw={600} style={{ color: 'var(--lab-text)' }}>
              {lang === 'zh' ? 'CPU Mock' : 'CPU Mock'}
            </Text>
            <Code block style={{ backgroundColor: 'var(--lab-bg)', borderRadius: 8, padding: 12 }}>
              {`uv run llm-rl-lab serve --mock`}
            </Code>
          </Stack>
        </Box>

        {localConnected && deviceTelemetry && (
          <Group gap={8} p={12} style={{ backgroundColor: 'var(--lab-accent-soft)', borderRadius: 12 }}>
            <LabIcon icon={CheckCircle} color="var(--lab-accent)" />
            <Text fz={14} fw={600} style={{ color: 'var(--lab-accent)' }}>
              {deviceTelemetry.device_name} · {deviceTelemetry.recommended_dtype}
              {deviceTelemetry.total_vram_gb > 0 ? ` · ${deviceTelemetry.total_vram_gb} GB` : ''}
            </Text>
          </Group>
        )}

        <TextInput
          size="sm"
          label={pickText(UI_STRINGS.modalServerUrl, lang)}
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          placeholder="http://127.0.0.1:8765"
          styles={{ input: { backgroundColor: 'var(--lab-surface)', border: 'none' } }}
        />
        <TextInput
          size="sm"
          label={pickText(UI_STRINGS.modalToken, lang)}
          value={token}
          onChange={(e) => setToken(e.currentTarget.value)}
          placeholder="Paste token"
          styles={{ input: { backgroundColor: 'var(--lab-surface)', border: 'none' } }}
        />

        {error && (
          <Text fz={13} ff="monospace" style={{ color: 'var(--lab-text)' }}>
            {error}
          </Text>
        )}

        <Group justify="flex-end" mt={8} gap={12}>
          {localConnected && (
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                disconnectLocal();
                setConnectModalOpen(false);
              }}
              styles={{ root: { height: 40 } }}
            >
              {pickText(UI_STRINGS.modalDisconnectBtn, lang)}
            </Button>
          )}
          <Button size="sm" loading={loading} onClick={handleConnect} styles={{ root: { height: 40 } }}>
            {pickText(UI_STRINGS.modalConnectBtn, lang)}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
