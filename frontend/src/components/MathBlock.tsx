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
      my={20}
      p={20}
      style={{
        backgroundColor: 'var(--lab-surface)',
        borderRadius: 12,
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {caption && (
        <Text fz={14} mt={12} lh={1.6} style={{ color: 'var(--lab-muted)' }}>
          {caption}
        </Text>
      )}
    </Box>
  );
}
