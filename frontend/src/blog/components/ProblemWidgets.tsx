import { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';
import { ChalkArrow, RoughStrokeSvg } from '../../components/ChalkPrimitives';
import { CHALK_COLORS } from '../types';

const { white, yellow, blue, green, coral } = CHALK_COLORS;

export function PuzzleSketch() {
  return (
    <figure className="blog-figure">
      <div
        className="chalk-title"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'clamp(16px, 2.2vw, 28px)',
          fontSize: 'clamp(36px, 4.8vw, 60px)',
          color: white,
          letterSpacing: '0.06em',
          whiteSpace: 'pre',
        }}
      >
        <span>3, &nbsp;7, &nbsp;12</span>
        <ChalkArrow width={96} height={40} color={yellow} strokeWidth={3.2} seed={102} />
        <span style={{ color: yellow }}>33</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <RoughStrokeSvg
          width={420}
          height={16}
          draw={(rc, svg) => {
            svg.appendChild(
              rc.line(12, 8, 408, 7, {
                stroke: 'rgba(235, 231, 220, 0.35)',
                strokeWidth: 2,
                roughness: 2.0,
                bowing: 1.5,
                seed: 101,
              })
            );
          }}
        />
      </div>
      <div
        className="chalk-title"
        style={{
          marginTop: 18,
          fontSize: 'clamp(24px, 2.8vw, 34px)',
          color: green,
        }}
      >
        3 × 7 + 12 = 33
      </div>
    </figure>
  );
}

const SIX_ATTEMPTS = [
  { expr: '3 + 7 + 12 = 22', ok: false },
  { expr: '12 × 3 - 7 = 29', ok: false },
  { expr: '3 × 7 + 12 = 33', ok: true },
  { expr: '12 + 7 - 3 = 16', ok: false },
  { expr: '7 × 12 - 3 = 81', ok: false },
  { expr: '12 × 3 + 7 = 43', ok: false },
];

export function SixTriesAnimation() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleCount((prev) => (prev >= SIX_ATTEMPTS.length + 2 ? 1 : prev + 1));
    }, 850);
    return () => window.clearInterval(timer);
  }, []);

  const shown = Math.min(SIX_ATTEMPTS.length, visibleCount);
  const hitVisible = shown >= 3;

  return (
    <figure className="blog-figure">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1fr) minmax(240px, 1.1fr)',
          gap: 28,
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <span
              className="chalk-title"
              style={{ fontSize: 28, color: 'var(--lab-muted)', minWidth: 88, whiteSpace: 'nowrap' }}
            >
              答 1 次
            </span>
            <span className="chalk-title" style={{ fontSize: 42, color: white, whiteSpace: 'nowrap' }}>
              16%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span
              className="chalk-title"
              style={{ fontSize: 28, color: yellow, minWidth: 88, whiteSpace: 'nowrap' }}
            >
              试 6 次
            </span>
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 22px',
              }}
            >
              <span
                className="chalk-title"
                style={{ fontSize: 40, color: yellow, whiteSpace: 'nowrap', lineHeight: 1.15 }}
              >
                ≈ 65%
              </span>
              <RoughStrokeSvg
                width={170}
                height={76}
                opacity={hitVisible ? 1 : 0.25}
                style={{
                  position: 'absolute',
                  left: -8,
                  top: -6,
                  width: 'calc(100% + 16px)',
                  height: 'calc(100% + 12px)',
                }}
                draw={(rc, svg) => {
                  svg.appendChild(
                    rc.ellipse(85, 38, 156, 62, {
                      stroke: yellow,
                      strokeWidth: 2.5,
                      roughness: 2.1,
                      bowing: 1.7,
                      seed: 202,
                    })
                  );
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {SIX_ATTEMPTS.map((item, idx) => {
            const active = idx < shown;
            return (
              <div
                key={item.expr}
                className="chalk-title"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '4px 12px',
                  fontSize: 22,
                  color: item.ok ? green : 'var(--lab-muted)',
                  opacity: active ? (item.ok ? 1 : 0.72) : 0.14,
                  transform: `translateX(${active ? 0 : 10}px)`,
                  transition: 'opacity 320ms ease, transform 320ms ease',
                }}
              >
                <span>
                  #{idx + 1} &nbsp;{item.expr}
                </span>
                <span style={{ color: item.ok ? green : coral, fontSize: item.ok ? 25 : 20 }}>
                  {item.ok ? '✓' : '×'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}

export function CoreQuestionSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((p) => (p + 1) % 4);
    }, 1150);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    g.appendChild(
      rc.rectangle(24, 28, 132, 68, {
        stroke: blue,
        strokeWidth: 2.2,
        fill: 'rgba(130, 173, 194, 0.12)',
        fillStyle: 'hachure',
        hachureGap: 9,
        roughness: 2.0,
        bowing: 1.4,
        seed: 401,
      })
    );

    g.appendChild(
      rc.line(164, 62, 232, 61, {
        stroke: white,
        strokeWidth: 2.2,
        roughness: 1.8,
        seed: 402,
      })
    );
    g.appendChild(
      rc.linearPath(
        [
          [221, 53],
          [234, 61],
          [222, 70],
        ],
        { stroke: white, strokeWidth: 2.2, roughness: 1.5, seed: 403 }
      )
    );

    g.appendChild(
      rc.rectangle(244, 28, 144, 68, {
        stroke: white,
        strokeWidth: 2.0,
        fill: 'rgba(235, 231, 220, 0.06)',
        fillStyle: 'hachure',
        hachureGap: 10,
        roughness: 2.0,
        bowing: 1.4,
        seed: 404,
      })
    );

    g.appendChild(
      rc.line(396, 62, 464, 61, {
        stroke: white,
        strokeWidth: 2.2,
        roughness: 1.8,
        seed: 405,
      })
    );
    g.appendChild(
      rc.linearPath(
        [
          [453, 53],
          [466, 61],
          [454, 70],
        ],
        { stroke: white, strokeWidth: 2.2, roughness: 1.5, seed: 406 }
      )
    );

    g.appendChild(
      rc.rectangle(476, 28, 140, 68, {
        stroke: green,
        strokeWidth: 2.2,
        fill: 'rgba(133, 184, 148, 0.12)',
        fillStyle: 'hachure',
        hachureGap: 9,
        roughness: 2.0,
        bowing: 1.4,
        seed: 407,
      })
    );

    g.appendChild(
      rc.curve(
        [
          [546, 102],
          [540, 166],
          [362, 168],
        ],
        {
          stroke: coral,
          strokeWidth: 2.2,
          roughness: 1.9,
          strokeLineDash: [8, 6],
          seed: 408,
        }
      )
    );

    g.appendChild(
      rc.circle(316, 168, 48, {
        stroke: yellow,
        strokeWidth: 2.4,
        fill: 'rgba(224, 192, 104, 0.14)',
        fillStyle: 'hachure',
        hachureGap: 6,
        roughness: 2.1,
        seed: 409,
      })
    );

    g.appendChild(
      rc.curve(
        [
          [270, 168],
          [94, 166],
          [90, 106],
        ],
        {
          stroke: coral,
          strokeWidth: 2.2,
          roughness: 1.9,
          strokeLineDash: [8, 6],
          seed: 410,
        }
      )
    );
    g.appendChild(
      rc.linearPath(
        [
          [82, 118],
          [90, 104],
          [99, 118],
        ],
        { stroke: coral, strokeWidth: 2.2, roughness: 1.5, seed: 411 }
      )
    );
  }, []);

  return (
    <figure className="blog-figure" style={{ padding: '28px 20px 20px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 640 204"
        width="100%"
        style={{ display: 'block', maxWidth: 640, overflow: 'visible' }}
        role="img"
        aria-label="模型生成与0/1裁判反向更新闭环图"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <g style={{ opacity: phase === 0 ? 1 : 0.78, transition: 'opacity 320ms ease' }}>
          <text
            x="90"
            y="70"
            textAnchor="middle"
            fill={blue}
            fontSize="26"
            className="chalk-title"
          >
            模型 θ
          </text>
        </g>

        <g style={{ opacity: phase === 1 ? 1 : 0.78, transition: 'opacity 320ms ease' }}>
          <text
            x="316"
            y="70"
            textAnchor="middle"
            fill={white}
            fontSize="26"
            className="chalk-title"
          >
            回答 y
          </text>
        </g>

        <g style={{ opacity: phase === 2 ? 1 : 0.78, transition: 'opacity 320ms ease' }}>
          <text
            x="546"
            y="70"
            textAnchor="middle"
            fill={green}
            fontSize="25"
            className="chalk-title"
          >
            裁判 R(y)
          </text>
        </g>

        <g style={{ opacity: phase === 3 ? 1 : 0.72, transition: 'opacity 320ms ease' }}>
          <text
            x="316"
            y="178"
            textAnchor="middle"
            fill={yellow}
            fontSize="30"
            className="chalk-title"
          >
            ?
          </text>
        </g>
      </svg>
    </figure>
  );
}

const HILL_POINTS: [number, number][] = [
  [84, 186],
  [140, 166],
  [200, 130],
  [260, 86],
  [330, 56],
  [400, 74],
  [465, 118],
  [530, 168],
];

const CLIMB_STEPS = [
  { x: 146, y: 162, tx1: 108, ty1: 184, tx2: 192, ty2: 136 },
  { x: 204, y: 127, tx1: 164, ty1: 155, tx2: 248, ty2: 96 },
  { x: 266, y: 82, tx1: 222, ty1: 106, tx2: 314, ty2: 56 },
  { x: 330, y: 56, tx1: 282, ty1: 56, tx2: 378, ty2: 56 },
];

export function GradientAscentSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIdx((prev) => (prev + 1) % CLIMB_STEPS.length);
    }, 1150);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    g.appendChild(
      rc.line(68, 198, 562, 198, {
        stroke: 'rgba(235, 231, 220, 0.5)',
        strokeWidth: 1.8,
        roughness: 1.6,
        seed: 501,
      })
    );
    g.appendChild(
      rc.linearPath(
        [
          [552, 192],
          [564, 198],
          [552, 204],
        ],
        { stroke: 'rgba(235, 231, 220, 0.5)', strokeWidth: 1.8, roughness: 1.4, seed: 502 }
      )
    );

    g.appendChild(
      rc.line(68, 198, 68, 28, {
        stroke: 'rgba(235, 231, 220, 0.5)',
        strokeWidth: 1.8,
        roughness: 1.6,
        seed: 503,
      })
    );
    g.appendChild(
      rc.linearPath(
        [
          [62, 38],
          [68, 26],
          [74, 38],
        ],
        { stroke: 'rgba(235, 231, 220, 0.5)', strokeWidth: 1.8, roughness: 1.4, seed: 504 }
      )
    );

    g.appendChild(
      rc.curve(HILL_POINTS, {
        stroke: white,
        strokeWidth: 2.5,
        roughness: 1.8,
        bowing: 1.2,
        seed: 505,
      })
    );

    g.appendChild(
      rc.line(330, 56, 330, 198, {
        stroke: 'rgba(224, 192, 104, 0.45)',
        strokeWidth: 1.5,
        roughness: 1.4,
        strokeLineDash: [6, 5],
        seed: 506,
      })
    );

    const cur = CLIMB_STEPS[stepIdx];
    g.appendChild(
      rc.line(cur.tx1, cur.ty1, cur.tx2, cur.ty2, {
        stroke: yellow,
        strokeWidth: 2.0,
        roughness: 1.6,
        seed: 510 + stepIdx,
      })
    );

    g.appendChild(
      rc.circle(cur.x, cur.y, 16, {
        stroke: green,
        fill: green,
        fillStyle: 'solid',
        strokeWidth: 2,
        roughness: 1.5,
        seed: 520 + stepIdx,
      })
    );

    if (stepIdx < CLIMB_STEPS.length - 1) {
      const next = CLIMB_STEPS[stepIdx + 1];
      g.appendChild(
        rc.line(cur.x, 198, next.x - 4, 198, {
          stroke: green,
          strokeWidth: 2.6,
          roughness: 1.5,
          seed: 530 + stepIdx,
        })
      );
      g.appendChild(
        rc.linearPath(
          [
            [next.x - 12, 192],
            [next.x - 2, 198],
            [next.x - 12, 204],
          ],
          { stroke: green, strokeWidth: 2.4, roughness: 1.3, seed: 535 + stepIdx }
        )
      );
    }
  }, [stepIdx]);

  return (
    <figure className="blog-figure" style={{ padding: '24px 20px 18px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 620 232"
        width="100%"
        style={{ display: 'block', maxWidth: 620, overflow: 'visible' }}
        role="img"
        aria-label="沿梯度方向爬坡最大化 J(theta) 手绘示意图"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <text x="58" y="20" textAnchor="end" fill={white} fontSize="22" className="chalk-title">
          J(θ)
        </text>
        <text x="576" y="205" textAnchor="start" fill={white} fontSize="22" className="chalk-title">
          θ
        </text>
        <text x="330" y="36" textAnchor="middle" fill={yellow} fontSize="20" className="chalk-title">
          max J(θ)
        </text>
        <text x="206" y="224" textAnchor="middle" fill={green} fontSize="19" className="chalk-title">
          沿梯度方向更新 θ
        </text>
      </svg>
    </figure>
  );
}
