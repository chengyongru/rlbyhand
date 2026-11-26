import { Box, Button, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Cpu } from 'reicon-react';
import { pickText } from '../i18n';
import { LESSONS } from '../i18n/lessons';
import { useLabStore } from '../store/useLabStore';
import { LabIcon } from './LabIcon';
import { MathBlock } from './MathBlock';
import { PredictCard } from './PredictCard';

export function LessonPane() {
  const { lang, activeLessonId, selectLesson } = useLabStore();
  const lessonIdx = Math.max(
    0,
    LESSONS.findIndex((l) => l.id === activeLessonId)
  );
  const lesson = LESSONS[lessonIdx];
  const prevLesson = lessonIdx > 0 ? LESSONS[lessonIdx - 1] : null;
  const nextLesson = lessonIdx < LESSONS.length - 1 ? LESSONS[lessonIdx + 1] : null;

  return (
    <Box
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--lab-bg)',
      }}
    >
      <ScrollArea style={{ flex: 1 }} px={32} py={32} offsetScrollbars>
        <Box maw={640} mx="auto" pb={48}>
          {/* Lesson Number + Title (no taglines, no subtitle, no extra dividers) */}
          <Text
            fz={14}
            fw={600}
            ff="monospace"
            mb={8}
            style={{ color: 'var(--lab-accent)' }}
          >
            {lesson.number}
          </Text>

          <Title
            order={1}
            fz={24}
            fw={700}
            mb={24}
            style={{ color: 'var(--lab-text)', letterSpacing: '-0.025em', lineHeight: 1.3 }}
          >
            {pickText(lesson.title, lang)}
          </Title>

          {lesson.id === 'lesson-3' && (
            <Box mb={24}>
              <Button
                component="a"
                href="./operator-study.html"
                size="sm"
                variant="light"
                rightSection={<LabIcon icon={ArrowRight} color="var(--lab-accent)" />}
                styles={{ root: { height: 36, fontWeight: 500 } }}
              >
                {lang === 'zh' ? '训练前后同卷：运算符三选一' : 'Before & after: operator quiz (ZH)'}
              </Button>
            </Box>
          )}

          {/* Textbook Sections separated purely by 32px whitespace */}
          <Stack gap={32}>
            {lesson.sections.map((sec, idx) => (
              <Box key={idx}>
                <Title
                  order={2}
                  fz={18}
                  fw={600}
                  mb={12}
                  style={{ color: 'var(--lab-text)', letterSpacing: '-0.015em', lineHeight: 1.4 }}
                >
                  {pickText(sec.heading, lang)}
                </Title>
                <Stack gap={12}>
                  {sec.paragraphs.map((p, pIdx) => (
                    <Text
                      key={pIdx}
                      fz={16}
                      fw={400}
                      lh={1.75}
                      style={{ color: 'var(--lab-muted)' }}
                    >
                      {pickText(p, lang)}
                    </Text>
                  ))}
                </Stack>

                {sec.formula && (
                  <MathBlock
                    tex={sec.formula}
                    caption={sec.formulaCaption ? pickText(sec.formulaCaption, lang) : undefined}
                  />
                )}

                {sec.callout && (
                  <Box
                    mt={20}
                    p={20}
                    style={{
                      backgroundColor: 'var(--lab-surface)',
                      borderRadius: 12,
                    }}
                  >
                    <Group gap={8} mb={8}>
                      <LabIcon
                        icon={
                          sec.callout.kind === 'warn'
                            ? AlertTriangle
                            : sec.callout.kind === 'vram'
                              ? Cpu
                              : BookOpen
                        }
                        color="var(--lab-text)"
                      />
                      <Text fz={14} fw={600} style={{ color: 'var(--lab-text)' }}>
                        {pickText(sec.callout.title, lang)}
                      </Text>
                    </Group>
                    <Text fz={14} lh={1.7} style={{ color: 'var(--lab-muted)' }}>
                      {pickText(sec.callout.body, lang)}
                    </Text>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>

          {/* CS 312 Predict Before You Run */}
          <PredictCard lessonId={lesson.id} predict={lesson.predict} />

          {/* Clean Prev / Next Navigation separated by generous whitespace */}
          <Group justify="space-between" mt={40}>
            {prevLesson ? (
              <Button
                size="sm"
                variant="subtle"
                color="gray"
                leftSection={<LabIcon icon={ArrowLeft} color="var(--lab-muted)" />}
                onClick={() => selectLesson(prevLesson.id)}
                styles={{ root: { height: 40, fontWeight: 500, color: 'var(--lab-text)' } }}
              >
                {prevLesson.number} · {pickText(prevLesson.shortTitle, lang)}
              </Button>
            ) : (
              <Box />
            )}
            {nextLesson && (
              <Button
                size="sm"
                variant="subtle"
                color="gray"
                rightSection={<LabIcon icon={ArrowRight} color="var(--lab-muted)" />}
                onClick={() => selectLesson(nextLesson.id)}
                styles={{ root: { height: 40, fontWeight: 500, color: 'var(--lab-text)' } }}
              >
                {nextLesson.number} · {pickText(nextLesson.shortTitle, lang)}
              </Button>
            )}
          </Group>
        </Box>
      </ScrollArea>
    </Box>
  );
}
