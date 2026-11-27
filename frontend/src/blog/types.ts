import type { ComponentType } from 'react';

export const CHALK_COLORS = {
  white: '#f3f0e6',
  yellow: '#ead07c',
  blue: '#95bfd4',
  green: '#98c9a6',
  coral: '#dc878d',
} as const;

export interface BlogChapter {
  id: string;
  number: string;
  name: string;
  title: string;
  published: boolean;
  Content: ComponentType;
}

export interface PlannedChapter {
  id: string;
  number: string;
  name: string;
}
