import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Single restrained accent color (#0071E3) — 90% neutral black/white/gray, 10% accent
const accent: MantineColorsTuple = [
  '#ebf5ff',
  '#d6ebff',
  '#add6ff',
  '#80bfff',
  '#4da6ff',
  '#1a8cff',
  '#0071e3',
  '#005ec2',
  '#004ca1',
  '#003a7d',
];

export const labTheme = createTheme({
  primaryColor: 'accent',
  primaryShade: { light: 6, dark: 5 },
  colors: { accent },
  defaultRadius: 'sm',
  radius: {
    xs: '8px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  fontFamily:
    '"Geist Sans", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontFamilyMonospace:
    '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  headings: {
    fontFamily:
      '"Geist Sans", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontWeight: '600',
  },
  components: {
    Paper: {
      defaultProps: {
        withBorder: false,
        shadow: 'none',
        radius: 'lg',
      },
    },
    Card: {
      defaultProps: {
        withBorder: false,
        shadow: 'none',
        radius: 'lg',
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
    Select: {
      defaultProps: {
        radius: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'sm',
      },
    },
    SegmentedControl: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'xl',
      },
    },
  },
});
