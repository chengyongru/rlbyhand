import { useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { ChevronDown, Cpu, Moon, Sun, TerminalSquare } from 'reicon-react';
import { useSafeTriangleMenu } from '../hooks/useSafeTriangle';
import { pickText, PRESET_LABELS, UI_STRINGS } from '../i18n';
import { LESSONS } from '../i18n/lessons';
import { useLabStore } from '../store/useLabStore';
import type { Lang } from '../types/lab';
import { LabIcon } from './LabIcon';

export function HeaderBar() {
  const {
    lang,
    setLang,
    activeLessonId,
    selectLesson,
    setActivePreset,
    localConnected,
    deviceTelemetry,
    setConnectModalOpen,
  } = useLabStore();
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme('light');

  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredLessonId, setHoveredLessonId] = useState(activeLessonId);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const { clearTimers, scheduleOpen, scheduleClose, shouldHoldSubmenu, recordPointer } =
    useSafeTriangleMenu(120, 220);

  const activeLesson = LESSONS.find((l) => l.id === activeLessonId) ?? LESSONS[0];
  const previewLesson = LESSONS.find((l) => l.id === hoveredLessonId) ?? activeLesson;

  return (
    <Box
      component="header"
      px={24}
      h={64}
      style={{
        backgroundColor: 'var(--lab-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexShrink: 0,
        position: 'relative',
        zIndex: 40,
      }}
    >
      {/* Left: Minimal Wordmark (no tagline or badge clutter) */}
      <Group gap={8} wrap="nowrap">
        <LabIcon icon={TerminalSquare} color="var(--lab-accent)" />
        <Text fw={600} fz={16} style={{ color: 'var(--lab-text)', letterSpacing: '-0.02em' }}>
          {pickText(UI_STRINGS.brandTitle, lang)}
        </Text>
      </Group>

      {/* Center: Desktop Multi-Level Lesson Menu with Open/Close Delay + Safe Triangle */}
      <Box
        style={{ position: 'relative' }}
        onMouseEnter={() => {
          scheduleOpen(() => {
            setHoveredLessonId(activeLessonId);
            setMenuOpen(true);
          });
        }}
        onMouseLeave={() => {
          scheduleClose(() => setMenuOpen(false));
        }}
      >
        <UnstyledButton
          onClick={() => {
            clearTimers();
            setHoveredLessonId(activeLessonId);
            setMenuOpen((o) => !o);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 12,
            backgroundColor: menuOpen ? 'var(--lab-surface)' : 'transparent',
            transition: 'background-color 140ms ease',
          }}
        >
          <Text fz={14} fw={600} ff="monospace" style={{ color: 'var(--lab-accent)' }}>
            {activeLesson.number}
          </Text>
          <Text fz={14} fw={500} style={{ color: 'var(--lab-text)' }}>
            {pickText(activeLesson.shortTitle, lang)}
          </Text>
          <LabIcon icon={ChevronDown} color="var(--lab-muted)" />
        </UnstyledButton>

        {menuOpen && (
          <Box
            p={12}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 600,
              maxWidth: 'calc(100vw - 32px)',
              backgroundColor: 'var(--lab-bg)',
              borderRadius: 20,
              border: '1px solid var(--lab-border)',
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              gap: 12,
              zIndex: 100,
            }}
            onMouseEnter={clearTimers}
            onMouseLeave={() => scheduleClose(() => setMenuOpen(false))}
          >
            {/* Primary Level: 6 Lessons */}
            <Stack gap={4}>
              {LESSONS.map((lesson) => {
                const isSelected = lesson.id === activeLessonId;
                const isHovered = lesson.id === previewLesson.id;
                return (
                  <UnstyledButton
                    key={lesson.id}
                    onMouseMove={(e) => {
                      const pt = { x: e.clientX, y: e.clientY };
                      if (lesson.id !== hoveredLessonId) {
                        if (!shouldHoldSubmenu(pt, submenuRef.current)) {
                          setHoveredLessonId(lesson.id);
                        }
                      } else {
                        recordPointer(pt.x, pt.y);
                      }
                    }}
                    onClick={() => {
                      selectLesson(lesson.id);
                      setMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      borderRadius: 12,
                      backgroundColor: isHovered ? 'var(--lab-surface)' : 'transparent',
                      transition: 'background-color 120ms ease',
                    }}
                  >
                    <Text
                      fz={13}
                      fw={600}
                      ff="monospace"
                      style={{ color: isSelected ? 'var(--lab-accent)' : 'var(--lab-muted)' }}
                    >
                      {lesson.number}
                    </Text>
                    <Text
                      fz={14}
                      fw={isSelected ? 600 : 400}
                      style={{ color: 'var(--lab-text)' }}
                    >
                      {pickText(lesson.shortTitle, lang)}
                    </Text>
                  </UnstyledButton>
                );
              })}
            </Stack>

            {/* Submenu Level: Presets for hovered lesson */}
            <Box
              ref={submenuRef}
              p={16}
              style={{
                backgroundColor: 'var(--lab-surface)',
                borderRadius: 12,
              }}
            >
              <Text fz={14} fw={600} mb={12} style={{ color: 'var(--lab-text)' }}>
                {pickText(previewLesson.title, lang)}
              </Text>
              <Stack gap={4}>
                {previewLesson.availablePresets.map((presetId) => (
                  <UnstyledButton
                    key={presetId}
                    onClick={() => {
                      selectLesson(previewLesson.id);
                      setActivePreset(presetId);
                      setMenuOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      textAlign: 'left',
                      transition: 'background-color 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--lab-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Text fz={14} fw={400} style={{ color: 'var(--lab-muted)' }}>
                      {PRESET_LABELS[presetId] ? pickText(PRESET_LABELS[presetId], lang) : presetId}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            </Box>
          </Box>
        )}
      </Box>

      {/* Right: Local GPU + ZH/EN + Theme */}
      <Group gap={12} wrap="nowrap">
        <Button
          size="sm"
          variant="subtle"
          color="gray"
          leftSection={<LabIcon icon={Cpu} color={localConnected ? 'var(--lab-accent)' : 'var(--lab-muted)'} />}
          onClick={() => setConnectModalOpen(true)}
          px={12}
          styles={{
            root: {
              height: 36,
              fontWeight: 500,
              fontSize: 14,
              color: 'var(--lab-text)',
              backgroundColor: localConnected ? 'var(--lab-surface)' : 'transparent',
            },
          }}
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
          variant="subtle"
          color="gray"
          size={36}
          radius="sm"
          aria-label="Toggle color scheme"
          onClick={() => setColorScheme(computedScheme === 'dark' ? 'light' : 'dark')}
        >
          <LabIcon icon={computedScheme === 'dark' ? Sun : Moon} color="var(--lab-text)" />
        </ActionIcon>
      </Group>
    </Box>
  );
}
