/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  export interface MdxChapterMeta {
    name: string;
    published: boolean;
    number?: string;
    title?: string;
  }
  export const meta: MdxChapterMeta;
  const MDXContent: ComponentType<{ components?: Record<string, ComponentType<never>> }>;
  export default MDXContent;
}
