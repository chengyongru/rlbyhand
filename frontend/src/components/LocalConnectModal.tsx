import { useState } from 'react';
import { Alert, Badge, Button, Code, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { CheckCircle2, Cpu, Terminal } from 'lucide-react';
import { fetchLocalDevice } from '../api/client';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';

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
      title={
        <Group gap={8}>
          <Cpu size={16} style={{ color: '#1d4ed8' }} />
          <Text fw={600} size="sm">
            {pickText(UI_STRINGS.modalTitle, lang)}
          </Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed" lh={1.6}>
          {pickText(UI_STRINGS.modalDesc, lang)}
        </Text>

        <Alert color="gray" variant="light" icon={<Terminal size={14} />}>
          <Stack gap={6}>
            <Text size="xs" fw={600}>
              {lang === 'zh' ? '1. 8GB 显卡真实运行（回家测试）' : '1. Real 8 GB GPU mode'}
            </Text>
            <Code block>
              {`uv sync --extra gpu\n# Optional mirror in China:\n# export HF_ENDPOINT=https://hf-mirror.com\nuv run llm-rl-lab serve`}
            </Code>
            <Text size="xs" fw={600} mt={4}>
              {lang === 'zh' ? '2. 无显卡 CPU 联调（Mock 流式模式）' : '2. CPU-only Mock WebSocket mode'}
            </Text>
            <Code block>{`uv run llm-rl-lab serve --mock`}</Code>
          </Stack>
        </Alert>

        {localConnected && deviceTelemetry && (
          <Alert color="teal" variant="light" icon={<CheckCircle2 size={15} />}>
            <Group gap={8} wrap="wrap">
              <Text size="xs" fw={600}>
                {deviceTelemetry.device_name}
              </Text>
              <Badge size="xs" ff="monospace">
                {deviceTelemetry.recommended_dtype}
              </Badge>
              {deviceTelemetry.total_vram_gb > 0 && (
                <Badge size="xs" color="gray" ff="monospace">
                  {deviceTelemetry.total_vram_gb} GB VRAM
                </Badge>
              )}
            </Group>
          </Alert>
        )}

        <TextInput
          size="xs"
          label={pickText(UI_STRINGS.modalServerUrl, lang)}
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          placeholder="http://127.0.0.1:8765"
        />
        <TextInput
          size="xs"
          label={pickText(UI_STRINGS.modalToken, lang)}
          value={token}
          onChange={(e) => setToken(e.currentTarget.value)}
          placeholder="Paste token from terminal"
        />

        {error && (
          <Text size="xs" c="red" ff="monospace">
            {error}
          </Text>
        )}

        <Group justify="flex-end" mt="xs">
          {localConnected && (
            <Button
              size="xs"
              variant="default"
              color="red"
              onClick={() => {
                disconnectLocal();
                setConnectModalOpen(false);
              }}
            >
              {pickText(UI_STRINGS.modalDisconnectBtn, lang)}
            </Button>
          )}
          <Button size="xs" loading={loading} onClick={handleConnect}>
            {pickText(UI_STRINGS.modalConnectBtn, lang)}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
