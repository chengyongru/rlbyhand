import { Alert, Badge, Box, Button, Divider, Group, ScrollArea, Select, Stack, Text, Title } from '@mantine/core';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Cpu } from 'lucide-react';
import { pickText, UI_STRINGS } from '../i18n';
import { LESSONS } from '../i18n/lessons';
import { useLabStore } from '../store/useLabStore';
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
      {/* Mobile/Narrow Lesson Selector */}
      <Box px="md" pt="sm" hiddenFrom="md">
        <Select
          size="xs"
          value={lesson.id}
          onChange={(v) => v && selectLesson(v)}
          data={LESSONS.map((l) => ({
            value: l.id,
            label: `${l.number} · ${pickText(l.title, lang)}`,
          }))}
        />
      </Box>

      <ScrollArea style={{ flex: 1 }} px="lg" py="md" offsetScrollbars>
        <Box maw={680} mx="auto" pb="xl">
          {/* Lesson Meta Header */}
          <Group gap={8} mb={8} wrap="wrap">
            <Badge
              size="xs"
              color="cobalt"
              variant="filled"
              style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
            >
              LESSON {lesson.number}
            </Badge>
            <Badge size="xs" color="gray" variant="outline">
              {pickText(UI_STRINGS.runtime, lang)}: {pickText(lesson.estimatedTime, lang)}
            </Badge>
            {lesson.mathPrereqs.map((m, idx) => (
              <Badge key={idx} size="xs" color="gray" variant="light">
                {pickText(m, lang)}
              </Badge>
            ))}
          </Group>

          <Title order={2} size="h3" mb={6} style={{ letterSpacing: '-0.02em', lineHeight: 1.3 }}>
            {pickText(lesson.title, lang)}
          </Title>
          <Text size="sm" c="dimmed" lh={1.65} mb="md">
            {pickText(lesson.subtitle, lang)}
          </Text>

          <Divider mb="md" color="var(--lab-border)" />

          {/* Textbook Sections */}
          <Stack gap="lg">
            {lesson.sections.map((sec, idx) => (
              <Box key={idx}>
                <Title order={4} size="sm" mb={8} fw={600}>
                  {pickText(sec.heading, lang)}
                </Title>
                <Stack gap={8}>
                  {sec.paragraphs.map((p, pIdx) => (
                    <Text key={pIdx} size="sm" lh={1.75} style={{ color: 'var(--lab-text)' }}>
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
                  <Alert
                    mt="sm"
                    variant="light"
                    color={
                      sec.callout.kind === 'warn'
                        ? 'red'
                        : sec.callout.kind === 'vram'
                          ? 'teal'
                          : 'cobalt'
                    }
                    icon={
                      sec.callout.kind === 'warn' ? (
                        <AlertTriangle size={15} />
                      ) : sec.callout.kind === 'vram' ? (
                        <Cpu size={15} />
                      ) : (
                        <BookOpen size={15} />
                      )
                    }
                    title={
                      <Text size="xs" fw={600}>
                        {pickText(sec.callout.title, lang)}
                      </Text>
                    }
                  >
                    <Text size="xs" lh={1.65}>
                      {pickText(sec.callout.body, lang)}
                    </Text>
                  </Alert>
                )}
              </Box>
            ))}
          </Stack>

          {/* CS 312 Predict Before You Run */}
          <PredictCard lessonId={lesson.id} predict={lesson.predict} />

          {/* Bottom Prev / Next Navigation */}
          <Divider my="lg" color="var(--lab-border)" />
          <Group justify="space-between">
            {prevLesson ? (
              <Button
                size="xs"
                variant="default"
                leftSection={<ArrowLeft size={13} />}
                onClick={() => selectLesson(prevLesson.id)}
              >
                {prevLesson.number} · {pickText(prevLesson.shortTitle, lang)}
              </Button>
            ) : (
              <Box />
            )}
            {nextLesson && (
              <Button
                size="xs"
                variant="default"
                rightSection={<ArrowRight size={13} />}
                onClick={() => selectLesson(nextLesson.id)}
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
