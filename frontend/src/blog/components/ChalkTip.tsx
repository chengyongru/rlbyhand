import type { ReactNode } from 'react';

interface ChalkTipProps {
  label: string;
  children: ReactNode;
}

export function ChalkTip({ label, children }: ChalkTipProps) {
  return (
    <span className="chalk-tip" tabIndex={0}>
      <span className="chalk-tip-trigger">{label}</span>
      <span className="chalk-tip-popover" role="tooltip">
        {children}
      </span>
    </span>
  );
}
