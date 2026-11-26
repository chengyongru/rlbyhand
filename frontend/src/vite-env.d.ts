/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const MDXContent: ComponentType<{ components?: Record<string, ComponentType<never>> }>;
  export default MDXContent;
}
