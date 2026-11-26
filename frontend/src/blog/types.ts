import type { ComponentType } from 'react';

export const CHALK_COLORS = {
  white: '#ebe7dc',
  yellow: '#e0c068',
  blue: '#82adc2',
  green: '#85b894',
  coral: '#cf7278',
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
