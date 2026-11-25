import { useMemo } from 'react';
import { Box, Text } from '@mantine/core';
import katex from 'katex';

interface MathBlockProps {
  tex: string;
  caption?: string;
}

export function MathBlock({ tex, caption }: MathBlockProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return tex;
    }
  }, [tex]);

  return (
    <Box
      my="sm"
      p="sm"
      style={{
        backgroundColor: 'var(--lab-formula-bg)',
        border: '1px solid var(--lab-border)',
        borderRadius: 4,
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {caption && (
        <Text size="xs" c="dimmed" mt={6} lh={1.55}>
          {caption}
        </Text>
      )}
    </Box>
  );
}
