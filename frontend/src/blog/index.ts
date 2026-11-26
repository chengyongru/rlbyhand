import type { ComponentType } from 'react';
import type { BlogChapter, PlannedChapter } from './types';

interface MdxChapterModule {
  default: ComponentType;
  meta?: {
    name: string;
    published?: boolean;
    number?: string;
    title?: string;
  };
}

const chapterModules = import.meta.glob<MdxChapterModule>('./chapters/*.mdx', {
  eager: true,
});

function parseChapter(filePath: string, mod: MdxChapterModule): BlogChapter {
  const fileName = filePath.split('/').pop() ?? filePath;
  const id = fileName.replace(/\.mdx$/, '');
  const numberMatch = id.match(/^(\d+)/);
  const number = mod.meta?.number ?? (numberMatch ? numberMatch[1] : '');
  const name = mod.meta?.name ?? id;
  const title = mod.meta?.title ?? (number ? `${number} ${name}` : name);
  const published = mod.meta?.published ?? false;

  return {
    id,
    number,
    name,
    title,
    published,
    Content: mod.default,
  };
}

export const ALL_CHAPTERS: BlogChapter[] = Object.entries(chapterModules)
  .map(([filePath, mod]) => parseChapter(filePath, mod))
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

export const IS_DEV_PREVIEW = import.meta.env.DEV;

export const BLOG_CHAPTERS: BlogChapter[] = IS_DEV_PREVIEW
  ? ALL_CHAPTERS
  : ALL_CHAPTERS.filter((c) => c.published);

const existingNumbers = new Set(ALL_CHAPTERS.map((c) => c.number));
const existingIds = new Set(ALL_CHAPTERS.map((c) => c.id));

const ALL_PLANNED_CHAPTERS: PlannedChapter[] = [
  { id: '02', number: '02', name: '***' },
  { id: '03', number: '03', name: '***' },
  { id: '04', number: '04', name: '***' },
  { id: '05', number: '05', name: '***' },
];

export const PLANNED_CHAPTERS: PlannedChapter[] = ALL_PLANNED_CHAPTERS.filter(
  (c) => !existingIds.has(c.id) && !existingNumbers.has(c.number)
);
