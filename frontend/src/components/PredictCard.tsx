import { Box, Button, Group, Radio, Stack, Text } from '@mantine/core';
import { CheckCircle, CloseCircle, Flask, Refresh } from 'reicon-react';
import { pickText, UI_STRINGS } from '../i18n';
import { useLabStore } from '../store/useLabStore';
import type { PredictChallenge } from '../types/lab';
import { LabIcon } from './LabIcon';

interface PredictCardProps {
  lessonId: string;
  predict: PredictChallenge;
}

export function PredictCard({ lessonId, predict }: PredictCardProps) {
  const { lang, predictions, selectPrediction, lockPrediction, resetPrediction } = useLabStore();
  const state = predictions[lessonId] ?? { selectedId: null, locked: false };
  const isCorrect = state.locked && state.selectedId === predict.correctOptionId;

  return (
    <Box
      className="intent-zone"
      p={24}
      mt={40}
      style={{
        backgroundColor: 'var(--lab-surface)',
        borderRadius: 16,
      }}
    >
      <Group justify="space-between" mb={16} wrap="nowrap">
        <Group gap={8}>
          <LabIcon icon={Flask} color="var(--lab-accent)" />
          <Text fw={600} fz={18} style={{ color: 'var(--lab-text)' }}>
            {pickText(predict.title, lang)}
          </Text>
        </Group>
        {state.locked && (
          <Button
            className="intent-controls"
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<LabIcon icon={Refresh} color="var(--lab-muted)" />}
            onClick={() => resetPrediction(lessonId)}
          >
            {pickText(UI_STRINGS.predictReset, lang)}
          </Button>
        )}
      </Group>

      <Text fz={14} lh={1.7} mb={16} style={{ color: 'var(--lab-muted)' }}>
        {pickText(predict.prompt, lang)}
      </Text>

      {/* Borderless inline diff lines (no nested boxes) */}
      <Stack gap={4} mb={20}>
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
      </Stack>

      {/* Borderless clickable option rows */}
      <Radio.Group
        value={state.selectedId ?? ''}
        onChange={(val) => {
          if (!state.locked) selectPrediction(lessonId, val);
        }}
      >
        <Stack gap={8}>
          {predict.options.map((opt) => {
            const isSelected = state.selectedId === opt.id;
            const isAnswer = opt.id === predict.correctOptionId;

            let bg = 'transparent';
            if (state.locked && isAnswer) bg = 'var(--lab-accent-soft)';
            else if (isSelected) bg = 'var(--lab-surface-hover)';

            return (
              <Box
                key={opt.id}
                px={12}
                py={12}
                onClick={() => {
                  if (!state.locked) selectPrediction(lessonId, opt.id);
                }}
                style={{
                  borderRadius: 12,
                  cursor: state.locked ? 'default' : 'pointer',
                  backgroundColor: bg,
                  transition: 'background-color 120ms ease',
                }}
              >
                <Radio
                  value={opt.id}
                  disabled={state.locked}
                  size="sm"
                  label={
                    <Text
                      fz={14}
                      fw={state.locked && isAnswer ? 600 : 400}
                      lh={1.6}
                      style={{
                        color:
                          state.locked && isAnswer ? 'var(--lab-accent)' : 'var(--lab-text)',
                      }}
                    >
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
        <Group justify="flex-end" mt={20}>
          <Button
            size="sm"
            disabled={!state.selectedId}
            onClick={() =>
              lockPrediction(lessonId, predict.experimentPresetId, predict.baselinePresetId)
            }
            px={20}
            styles={{ root: { height: 40, fontWeight: 500 } }}
          >
            {pickText(UI_STRINGS.predictLockBtn, lang)}
          </Button>
        </Group>
      ) : (
        <Box mt={20} pt={16}>
          <Group gap={8} mb={8}>
            <LabIcon
              icon={isCorrect ? CheckCircle : CloseCircle}
              color={isCorrect ? 'var(--lab-accent)' : 'var(--lab-text)'}
            />
            <Text
              fz={14}
              fw={600}
              style={{ color: isCorrect ? 'var(--lab-accent)' : 'var(--lab-text)' }}
            >
              {isCorrect
                ? pickText(UI_STRINGS.predictCorrect, lang)
                : pickText(UI_STRINGS.predictWrong, lang)}
            </Text>
          </Group>
          <Text fz={14} lh={1.7} style={{ color: 'var(--lab-muted)' }}>
            {pickText(predict.explanation, lang)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
