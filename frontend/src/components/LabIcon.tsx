import type { CSSProperties } from 'react';
import type { IconComponent } from 'reicon-react';

interface LabIconProps {
  icon: IconComponent;
  color?: string;
  style?: CSSProperties;
}

/**
 * Enforces DESIGN.md Module 3 icon geometry:
 * 18px glyph with 1.5px stroke inside a fixed transparent 24x24px frame.
 */
export function LabIcon({ icon: Icon, color, style }: LabIconProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        flexShrink: 0,
        backgroundColor: 'transparent',
        ...style,
      }}
    >
      <Icon size={18} strokeWidth={1.5} color={color} />
    </span>
  );
}
