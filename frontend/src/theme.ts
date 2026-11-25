import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Restrained technical blueprint cobalt — avoids generic neon/purple AI palettes
const cobalt: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
];

export const labTheme = createTheme({
  primaryColor: 'cobalt',
  primaryShade: { light: 7, dark: 5 },
  colors: { cobalt },
  defaultRadius: 'sm',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontFamilyMonospace:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontWeight: '600',
  },
  components: {
    Paper: {
      defaultProps: {
        withBorder: true,
        shadow: 'none',
      },
    },
    Card: {
      defaultProps: {
        withBorder: true,
        shadow: 'none',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
        variant: 'light',
      },
    },
    Button: {
      defaultProps: {
        radius: 'sm',
      },
    },
  },
});
