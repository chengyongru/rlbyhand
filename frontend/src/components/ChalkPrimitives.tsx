import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import rough from 'roughjs';

export function ChalkSvgDefs() {
  return (
    <svg
      width="1"
      height="1"
      style={{ position: 'fixed', top: -10, left: -10, opacity: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="chalk-stroke-filter" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter id="chalk-text-filter" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.58"
            numOctaves="3"
            seed="13"
            result="fineGrain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fineGrain"
            scale="2.1"
            xChannelSelector="R"
            yChannelSelector="G"
            result="roughened"
          />
          <feColorMatrix
            in="fineGrain"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.35 0.18"
            result="chalkMask"
          />
          <feComposite in="roughened" in2="chalkMask" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

interface ChalkBoxProps {
  children: ReactNode;
  stroke?: string;
  fill?: string;
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots';
  roughness?: number;
  strokeWidth?: number;
  dashed?: boolean;
  seed?: number;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function ChalkBox({
  children,
  stroke = 'rgba(245, 241, 228, 0.42)',
  fill,
  fillStyle = 'hachure',
  roughness = 1.65,
  strokeWidth = 1.6,
  dashed = false,
  seed = 11,
  padding = 18,
  className,
  style,
}: ChalkBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 10 || size.h < 10) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);
    const pad = 3;
    const node = rc.rectangle(pad, pad, size.w - pad * 2, size.h - pad * 2, {
      stroke,
      strokeWidth,
      roughness,
      bowing: 1.5,
      seed,
      fill,
      fillStyle,
      fillWeight: 0.7,
      hachureGap: 10,
      strokeLineDash: dashed ? [8, 6] : undefined,
    });
    svg.appendChild(node);
  }, [size.w, size.h, stroke, fill, fillStyle, roughness, strokeWidth, dashed, seed]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        padding,
        ...style,
      }}
    >
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
          filter: 'url(#chalk-stroke-filter)',
        }}
        aria-hidden="true"
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export function RoughStrokeSvg({
  width,
  height,
  draw,
  opacity = 1,
  style,
}: {
  width: number;
  height: number;
  draw: (rc: ReturnType<typeof rough.svg>, svg: SVGSVGElement) => void;
  opacity?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);
    draw(rc, svg);
  }, [width, height]);

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        overflow: 'visible',
        pointerEvents: 'none',
        filter: 'url(#chalk-stroke-filter)',
        opacity,
        transition: 'opacity 260ms ease',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function ChalkArrow({
  width = 84,
  height = 36,
  color = '#e0c068',
  strokeWidth = 2.6,
  seed = 77,
  direction = 'right',
}: {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  seed?: number;
  direction?: 'right' | 'down';
}) {
  return (
    <RoughStrokeSvg
      width={width}
      height={height}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      draw={(rc, svg) => {
        if (direction === 'right') {
          const y = height / 2;
          const x2 = width - 8;
          svg.appendChild(
            rc.line(6, y, x2, y - 1, { stroke: color, strokeWidth, roughness: 1.9, bowing: 1.4, seed })
          );
          svg.appendChild(
            rc.linearPath(
              [
                [x2 - 13, y - 10],
                [x2 + 1, y - 1],
                [x2 - 12, y + 9],
              ],
              { stroke: color, strokeWidth, roughness: 1.6, seed: seed + 1 }
            )
          );
        } else {
          const x = width / 2;
          const y2 = height - 4;
          svg.appendChild(
            rc.line(x, 3, x, y2, { stroke: color, strokeWidth, roughness: 1.6, seed })
          );
          svg.appendChild(
            rc.linearPath(
              [
                [x - 5, y2 - 6],
                [x, y2 + 1],
                [x + 5, y2 - 6],
              ],
              { stroke: color, strokeWidth, roughness: 1.4, seed: seed + 1 }
            )
          );
        }
      }}
    />
  );
}
