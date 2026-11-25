import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  SegmentedControl,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { Cpu, Moon, Sun, Terminal } from 'lucide-react';
import { pickText, UI_STRINGS } from '../i18n';
import { LESSONS } from '../i18n/lessons';
import { useLabStore } from '../store/useLabStore';
import type { Lang } from '../types/lab';

export function HeaderBar() {
  const {
    lang,
    setLang,
    activeLessonId,
    selectLesson,
    localConnected,
    deviceTelemetry,
    setConnectModalOpen,
  } = useLabStore();
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme('light');

  return (
    <Box
      component="header"
      px="md"
      h={52}
      style={{
        backgroundColor: 'var(--lab-surface)',
        borderBottom: '1px solid var(--lab-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Left: Restrained Wordmark */}
      <Group gap={10} wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <Terminal size={17} strokeWidth={2.2} style={{ color: '#1d4ed8' }} />
          <Text fw={700} size="sm" style={{ letterSpacing: '-0.02em' }}>
            {pickText(UI_STRINGS.brandTitle, lang)}
          </Text>
        </Group>
        <Badge
          size="xs"
          variant="outline"
          color="gray"
          style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontWeight: 500 }}
        >
          {pickText(UI_STRINGS.brandTag, lang)}
        </Badge>
      </Group>

      {/* Center: Compact 6-Lesson Stepper */}
      <Group gap={4} wrap="nowrap" visibleFrom="md">
        {LESSONS.map((lesson) => {
          const isActive = lesson.id === activeLessonId;
          return (
            <Tooltip
              key={lesson.id}
              label={`${lesson.number} · ${pickText(lesson.title, lang)}`}
              position="bottom"
              withArrow
            >
              <Button
                size="compact-xs"
                variant={isActive ? 'filled' : 'subtle'}
                color={isActive ? 'cobalt' : 'gray'}
                onClick={() => selectLesson(lesson.id)}
                px={isActive ? 10 : 8}
                style={{
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <Text
                  component="span"
                  size="xs"
                  ff="monospace"
                  mr={isActive ? 5 : 0}
                  style={{ opacity: isActive ? 0.9 : 0.75 }}
                >
                  {lesson.number}
                </Text>
                {isActive && (
                  <Text component="span" size="xs">
                    {pickText(lesson.shortTitle, lang)}
                  </Text>
                )}
              </Button>
            </Tooltip>
          );
        })}
      </Group>

      {/* Right: Local GPU status + ZH/EN + Theme */}
      <Group gap={8} wrap="nowrap">
        <Button
          size="compact-xs"
          variant={localConnected ? 'light' : 'default'}
          color={localConnected ? 'teal' : 'gray'}
          leftSection={<Cpu size={13} />}
          onClick={() => setConnectModalOpen(true)}
        >
          {localConnected
            ? `${pickText(UI_STRINGS.localConnected, lang)}${
                deviceTelemetry?.mock_mode ? ' (Mock)' : ''
              }`
            : pickText(UI_STRINGS.localOffline, lang)}
        </Button>

        <SegmentedControl
          size="xs"
          value={lang}
          onChange={(v) => setLang(v as Lang)}
          data={[
            { label: '中文', value: 'zh' },
            { label: 'EN', value: 'en' },
          ]}
        />

        <ActionIcon
          variant="default"
          size="sm"
          aria-label="Toggle color scheme"
          onClick={() => setColorScheme(computedScheme === 'dark' ? 'light' : 'dark')}
        >
          {computedScheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </ActionIcon>
      </Group>
    </Box>
  );
}
