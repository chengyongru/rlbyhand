import { Alert, Badge, Box, Button, Group, Paper, Radio, Stack, Text } from '@mantine/core';
import { CheckCircle2, FlaskConical, RotateCcw, XCircle } from 'lucide-react';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { PredictChallenge } from '../types/lab';

interface PredictCardProps {
  lessonId: string;
  predict: PredictChallenge;
}

export function PredictCard({ lessonId, predict }: PredictCardProps) {
  const { lang, predictions, selectPrediction, lockPrediction, resetPrediction } = useLabStore();
  const state = predictions[lessonId] ?? { selectedId: null, locked: false };
  const isCorrect = state.locked && state.selectedId === predict.correctOptionId;

  return (
    <Paper
      p="md"
      mt="lg"
      style={{
        backgroundColor: 'var(--lab-surface)',
        borderColor: 'var(--lab-border)',
        borderLeft: '3px solid #1d4ed8',
      }}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap={6}>
          <FlaskConical size={15} style={{ color: '#1d4ed8' }} />
          <Text size="xs" fw={600} tt="uppercase" c="cobalt" style={{ letterSpacing: '0.04em' }}>
            {pickText(UI_STRINGS.predictBadge, lang)}
          </Text>
        </Group>
        {state.locked && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<RotateCcw size={12} />}
            onClick={() => resetPrediction(lessonId)}
          >
            {pickText(UI_STRINGS.predictReset, lang)}
          </Button>
        )}
      </Group>

      <Text fw={600} size="sm" mb={6}>
        {pickText(predict.title, lang)}
      </Text>
      <Text size="sm" c="dimmed" lh={1.6} mb="sm">
        {pickText(predict.prompt, lang)}
      </Text>

      {/* Code Diff Block */}
      <Box
        mb="sm"
        py={6}
        style={{
          border: '1px solid var(--lab-border)',
          borderRadius: 4,
          backgroundColor: 'var(--lab-formula-bg)',
          overflowX: 'auto',
        }}
      >
        {predict.diffLines.map((line, i) => (
          <div
            key={i}
            className={`diff-line ${
              line.type === 'add'
                ? 'diff-line-add'
                : line.type === 'del'
                  ? 'diff-line-del'
                  : 'diff-line-ctx'
            }`}
          >
            {line.text}
          </div>
        ))}
      </Box>

      {/* Options */}
      <Radio.Group
        value={state.selectedId ?? ''}
        onChange={(val) => {
          if (!state.locked) selectPrediction(lessonId, val);
        }}
      >
        <Stack gap={6}>
          {predict.options.map((opt) => {
            const isSelected = state.selectedId === opt.id;
            const isAnswer = opt.id === predict.correctOptionId;
            let borderColor = 'var(--lab-border)';
            if (state.locked && isAnswer) borderColor = '#059669';
            else if (state.locked && isSelected && !isAnswer) borderColor = '#dc2626';
            else if (isSelected) borderColor = '#1d4ed8';

            return (
              <Box
                key={opt.id}
                px="sm"
                py={8}
                onClick={() => {
                  if (!state.locked) selectPrediction(lessonId, opt.id);
                }}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 4,
                  cursor: state.locked ? 'default' : 'pointer',
                  backgroundColor:
                    state.locked && isAnswer
                      ? 'var(--lab-diff-add-bg)'
                      : 'transparent',
                }}
              >
                <Radio
                  value={opt.id}
                  disabled={state.locked}
                  size="xs"
                  label={
                    <Text size="xs" lh={1.55}>
                      {pickText(opt.label, lang)}
                    </Text>
                  }
                />
              </Box>
            );
          })}
        </Stack>
      </Radio.Group>

      {!state.locked ? (
        <Group justify="flex-end" mt="sm">
          <Button
            size="xs"
            disabled={!state.selectedId}
            onClick={() =>
              lockPrediction(lessonId, predict.experimentPresetId, predict.baselinePresetId)
            }
          >
            {pickText(UI_STRINGS.predictLockBtn, lang)}
          </Button>
        </Group>
      ) : (
        <Alert
          mt="sm"
          variant="light"
          color={isCorrect ? 'teal' : 'orange'}
          icon={isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          title={
            <Group gap={8}>
              <Text size="xs" fw={600}>
                {isCorrect
                  ? pickText(UI_STRINGS.predictCorrect, lang)
                  : pickText(UI_STRINGS.predictWrong, lang)}
              </Text>
              <Badge size="xs" color="cobalt" variant="outline">
                {pickText(UI_STRINGS.predictOverlaid, lang)}
              </Badge>
            </Group>
          }
        >
          <Text size="xs" lh={1.6}>
            {pickText(predict.explanation, lang)}
          </Text>
        </Alert>
      )}
    </Paper>
  );
}
