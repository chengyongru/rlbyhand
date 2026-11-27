import { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';
import { CHALK_COLORS } from '../types';

const { white, yellow, blue, green, coral } = CHALK_COLORS;

function t1ToX(t1: number): number {
  return 90 + ((t1 - 0.5) / 5.0) * 440;
}

function t2ToY(t2: number): number {
  return 214 - ((t2 + 0.6) / 6.0) * 186;
}

function drawAxesAndContours(rc: ReturnType<typeof rough.svg>, g: SVGGElement, seedBase: number) {
  g.appendChild(
    rc.line(74, 214, 558, 214, {
      stroke: 'rgba(243, 240, 230, 0.45)',
      strokeWidth: 1.8,
      roughness: 1.4,
      seed: seedBase + 1,
    })
  );
  g.appendChild(
    rc.linearPath(
      [
        [548, 208],
        [560, 214],
        [548, 220],
      ],
      { stroke: 'rgba(243, 240, 230, 0.45)', strokeWidth: 1.8, roughness: 1.2, seed: seedBase + 2 }
    )
  );

  g.appendChild(
    rc.line(74, 214, 74, 24, {
      stroke: 'rgba(243, 240, 230, 0.45)',
      strokeWidth: 1.8,
      roughness: 1.4,
      seed: seedBase + 3,
    })
  );
  g.appendChild(
    rc.linearPath(
      [
        [68, 34],
        [74, 22],
        [80, 34],
      ],
      { stroke: 'rgba(243, 240, 230, 0.45)', strokeWidth: 1.8, roughness: 1.2, seed: seedBase + 4 }
    )
  );

  const cx = t1ToX(3);
  const cy = t2ToY(2);
  const pxPerT1 = 440 / 5.0;
  const pxPerT2 = 186 / 6.0;
  const radii = [0.85, 1.55, 2.24, 3.0];
  radii.forEach((r, idx) => {
    g.appendChild(
      rc.ellipse(cx, cy, r * 2 * pxPerT1, r * 2 * pxPerT2, {
        stroke: 'rgba(243, 240, 230, 0.2)',
        strokeWidth: 1.3,
        strokeLineDash: [6, 5],
        roughness: 1.5,
        seed: seedBase + 10 + idx,
      })
    );
  });

  g.appendChild(
    rc.circle(cx, cy, 12, {
      stroke: yellow,
      fill: yellow,
      fillStyle: 'solid',
      strokeWidth: 1.8,
      roughness: 1.2,
      seed: seedBase + 20,
    })
  );
}

function drawArrow(
  rc: ReturnType<typeof rough.svg>,
  g: SVGGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  seed: number,
  dashed = false
) {
  g.appendChild(
    rc.line(x1, y1, x2, y2, {
      stroke: color,
      strokeWidth: 2.3,
      strokeLineDash: dashed ? [6, 5] : undefined,
      roughness: 1.4,
      seed,
    })
  );
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 11;
  const a1 = angle - 0.45;
  const a2 = angle + 0.45;
  g.appendChild(
    rc.linearPath(
      [
        [x2 - headLen * Math.cos(a1), y2 - headLen * Math.sin(a1)],
        [x2, y2],
        [x2 - headLen * Math.cos(a2), y2 - headLen * Math.sin(a2)],
      ],
      { stroke: color, strokeWidth: 2.2, roughness: 1.2, seed: seed + 1 }
    )
  );
}

function proj3d(t1: number, t2: number, z: number): [number, number] {
  const u = t1 - 3;
  const v = t2 - 2;
  const x = 328 + u * 54 + v * 32;
  const y = 204 + u * 12 - v * 14 - z * 12.5;
  return [x, y];
}

function surfaceZ(t1: number, t2: number): number {
  return -Math.pow(t1 - 3, 2) - Math.pow(t2 - 2, 2) + 10;
}

export function ContourGradientSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    const origin = proj3d(0.0, -0.8, 0);
    const t1End = proj3d(5.6, -0.8, 0);
    const t2End = proj3d(0.0, 2.5, 0);
    const zEnd = proj3d(0.0, -0.8, 11.4);

    const axisColor = 'rgba(243, 240, 230, 0.38)';
    drawArrow(rc, g, origin[0], origin[1], t1End[0], t1End[1], axisColor, 751);
    drawArrow(rc, g, origin[0], origin[1], t2End[0], t2End[1], axisColor, 753);
    drawArrow(rc, g, origin[0], origin[1], zEnd[0], zEnd[1], axisColor, 755);

    const baseZ = 2.4;
    const maxR = Math.sqrt(10 - baseZ);
    const phi0 = Math.atan2(32, 54);

    const backBasePts: [number, number][] = [];
    const frontBasePts: [number, number][] = [];
    for (let k = 0; k <= 16; k += 1) {
      const angBack = phi0 + (k / 16) * Math.PI;
      backBasePts.push(proj3d(3 + maxR * Math.cos(angBack), 2 + maxR * Math.sin(angBack), baseZ));
      const angFront = phi0 - Math.PI + (k / 16) * Math.PI;
      frontBasePts.push(proj3d(3 + maxR * Math.cos(angFront), 2 + maxR * Math.sin(angFront), baseZ));
    }

    g.appendChild(
      rc.curve(backBasePts, {
        stroke: 'rgba(243, 240, 230, 0.16)',
        strokeWidth: 1.2,
        strokeLineDash: [5, 5],
        roughness: 1.1,
        seed: 760,
      })
    );

    const silhouettePts: [number, number][] = [];
    for (let s = -12; s <= 12; s += 1) {
      const d = (s / 12) * maxR;
      const t1 = 3 + d * Math.cos(phi0);
      const t2 = 2 + d * Math.sin(phi0);
      silhouettePts.push(proj3d(t1, t2, surfaceZ(t1, t2)));
    }
    const domePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const domeD = [
      `M ${silhouettePts[0][0]} ${silhouettePts[0][1]}`,
      ...silhouettePts.slice(1).map((p) => `L ${p[0]} ${p[1]}`),
      ...frontBasePts.slice().reverse().map((p) => `L ${p[0]} ${p[1]}`),
      'Z',
    ].join(' ');
    domePath.setAttribute('d', domeD);
    domePath.setAttribute('fill', 'rgba(17, 36, 28, 0.82)');
    domePath.setAttribute('stroke', 'none');
    g.appendChild(domePath);

    g.appendChild(
      rc.curve(silhouettePts, {
        stroke: 'rgba(243, 240, 230, 0.56)',
        strokeWidth: 2.0,
        roughness: 1.3,
        seed: 762,
      })
    );

    [5.4, 8.2].forEach((zVal, idx) => {
      const r = Math.sqrt(10 - zVal);
      const frontArc: [number, number][] = [];
      for (let k = 0; k <= 16; k += 1) {
        const ang = phi0 - Math.PI + (k / 16) * Math.PI;
        frontArc.push(proj3d(3 + r * Math.cos(ang), 2 + r * Math.sin(ang), zVal));
      }
      g.appendChild(
        rc.curve(frontArc, {
          stroke: 'rgba(243, 240, 230, 0.24)',
          strokeWidth: 1.2,
          strokeLineDash: [5, 5],
          roughness: 1.1,
          seed: 766 + idx,
        })
      );
    });

    g.appendChild(
      rc.curve(frontBasePts, {
        stroke: 'rgba(243, 240, 230, 0.5)',
        strokeWidth: 1.8,
        roughness: 1.3,
        seed: 769,
      })
    );

    const peakTop = proj3d(3, 2, 10);
    g.appendChild(
      rc.circle(peakTop[0], peakTop[1], 12, {
        stroke: yellow,
        fill: yellow,
        fillStyle: 'solid',
        strokeWidth: 1.8,
        roughness: 1.2,
        seed: 779,
      })
    );

    const startTop = proj3d(2, 0, surfaceZ(2, 0));
    g.appendChild(
      rc.circle(startTop[0], startTop[1], 12, {
        stroke: blue,
        fill: blue,
        fillStyle: 'solid',
        strokeWidth: 1.8,
        roughness: 1.2,
        seed: 781,
      })
    );

    const pT1 = proj3d(2.75, 0, surfaceZ(2.75, 0));
    const pT2 = proj3d(2, 1.15, surfaceZ(2, 1.15));
    const pGrad = proj3d(2.6, 1.2, surfaceZ(2.6, 1.2));

    if (phase >= 0) {
      drawArrow(rc, g, startTop[0], startTop[1], pT1[0], pT1[1], green, 783);
    }
    if (phase >= 1) {
      drawArrow(rc, g, startTop[0], startTop[1], pT2[0], pT2[1], coral, 786);
    }
    if (phase >= 2) {
      drawArrow(rc, g, startTop[0], startTop[1], pGrad[0], pGrad[1], yellow, 789);
    }
  }, [phase]);

  const peakTop = proj3d(3, 2, 10);
  const startTop = proj3d(2, 0, surfaceZ(2, 0));
  const t1End = proj3d(5.6, -0.8, 0);
  const t2End = proj3d(0.0, 2.5, 0);
  const zEnd = proj3d(0.0, -0.8, 11.4);

  return (
    <figure className="blog-figure" style={{ padding: '20px 16px 16px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 640 296"
        width="100%"
        style={{ display: 'block', maxWidth: 640 }}
        role="img"
        aria-label="双参数三维抛物面与梯度向量方向示意图"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <text x={zEnd[0]} y={zEnd[1] - 14} textAnchor="middle" fill={white} fontSize="19" className="chalk-title">
          J(θ₁, θ₂)
        </text>
        <text x={t1End[0] + 10} y={t1End[1] + 6} textAnchor="start" fill={white} fontSize="19" className="chalk-title">
          θ₁
        </text>
        <text x={t2End[0] - 10} y={t2End[1] - 8} textAnchor="end" fill={white} fontSize="19" className="chalk-title">
          θ₂
        </text>

        <text x={peakTop[0]} y={peakTop[1] - 18} textAnchor="middle" fill={yellow} fontSize="19" className="chalk-title">
          max (3, 2, 10)
        </text>

        <text x={startTop[0] - 14} y={startTop[1] + 24} textAnchor="end" fill={blue} fontSize="18" className="chalk-title">
          起点 (2, 0)
        </text>

        <text x={startTop[0] + 48} y={startTop[1] + 24} textAnchor="start" fill={green} fontSize="18" className="chalk-title">
          +2
        </text>
        <text
          x={startTop[0] + 4}
          y={startTop[1] - 54}
          textAnchor="end"
          fill={coral}
          fontSize="18"
          className="chalk-title"
          style={{ opacity: phase >= 1 ? 1 : 0.2, transition: 'opacity 300ms ease' }}
        >
          +4
        </text>
        <text
          x={startTop[0] + 92}
          y={startTop[1] - 26}
          textAnchor="start"
          fill={yellow}
          fontSize="19"
          className="chalk-title"
          style={{ opacity: phase >= 2 ? 1 : 0.18, transition: 'opacity 300ms ease' }}
        >
          ∇J = (2, 4)
        </text>
      </svg>
    </figure>
  );
}

const MODES: { label: string; color: string; steps: [number, number][] }[] = [
  {
    label: 'α = 0.1  稳定收敛',
    color: green,
    steps: [
      [2.0, 0.0],
      [2.2, 0.4],
      [2.36, 0.72],
      [2.49, 0.98],
      [2.59, 1.18],
    ],
  },
  {
    label: 'α = 1.2  步长过大直接越过',
    color: coral,
    steps: [
      [2.0, 0.0],
      [4.4, 4.8],
    ],
  },
];

export function LearningRateSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [modeIdx, setModeIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setModeIdx((prev) => (prev + 1) % MODES.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    drawAxesAndContours(rc, g, 810);

    const mode = MODES[modeIdx];
    const pts = mode.steps;
    for (let i = 0; i < pts.length; i += 1) {
      const cx = t1ToX(pts[i][0]);
      const cy = t2ToY(pts[i][1]);
      if (i > 0) {
        const px = t1ToX(pts[i - 1][0]);
        const py = t2ToY(pts[i - 1][1]);
        drawArrow(rc, g, px, py, cx, cy, mode.color, 840 + modeIdx * 20 + i * 2, modeIdx === 1);
      }
      g.appendChild(
        rc.circle(cx, cy, i === 0 ? 12 : 11, {
          stroke: i === 0 ? blue : mode.color,
          fill: i === 0 ? blue : mode.color,
          fillStyle: 'solid',
          strokeWidth: 1.6,
          roughness: 1.2,
          seed: 880 + modeIdx * 10 + i,
        })
      );
    }
  }, [modeIdx]);

  const mode = MODES[modeIdx];

  return (
    <figure className="blog-figure" style={{ padding: '24px 20px 18px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 620 250"
        width="100%"
        style={{ display: 'block', maxWidth: 620, overflow: 'visible' }}
        role="img"
        aria-label="双参数下学习率适中稳定收敛与学习率过大越过最大值点对比"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <text x="64" y="20" textAnchor="end" fill={white} fontSize="20" className="chalk-title">
          θ₂
        </text>
        <text x="572" y="220" textAnchor="start" fill={white} fontSize="20" className="chalk-title">
          θ₁
        </text>
        <text x={t1ToX(3) + 14} y={t2ToY(2) + 6} textAnchor="start" fill={yellow} fontSize="19" className="chalk-title">
          max (3, 2)
        </text>
        <text x={t1ToX(2) - 10} y={t2ToY(0) + 24} textAnchor="end" fill={blue} fontSize="18" className="chalk-title">
          (2, 0)
        </text>
        {modeIdx === 1 && (
          <text x={t1ToX(4.4) + 12} y={t2ToY(4.8) + 6} textAnchor="start" fill={coral} fontSize="18" className="chalk-title">
            (4.4, 4.8)
          </text>
        )}
        <text x="454" y="34" textAnchor="middle" fill={mode.color} fontSize="20" className="chalk-title">
          {mode.label}
        </text>
      </svg>
    </figure>
  );
}

export function BackpropGraphSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    const boxes: [number, number, number, number, string, number][] = [
      [18, 30, 88, 50, blue, 901],
      [18, 146, 88, 50, blue, 902],
      [164, 30, 102, 50, white, 903],
      [164, 146, 102, 50, white, 904],
      [326, 30, 106, 50, white, 905],
      [326, 146, 106, 50, white, 906],
      [496, 84, 122, 60, yellow, 907],
    ];

    boxes.forEach(([x, y, w, h, stroke, seed]) => {
      g.appendChild(
        rc.rectangle(x, y, w, h, {
          stroke,
          strokeWidth: 2.0,
          fill: 'rgba(243, 240, 230, 0.05)',
          fillStyle: 'hachure',
          hachureGap: 10,
          roughness: 1.7,
          seed,
        })
      );
    });

    const fwdColor = 'rgba(243, 240, 230, 0.55)';
    drawArrow(rc, g, 108, 47, 161, 47, fwdColor, 910);
    drawArrow(rc, g, 268, 47, 323, 47, fwdColor, 912);
    drawArrow(rc, g, 434, 54, 493, 102, fwdColor, 914);
    drawArrow(rc, g, 108, 163, 161, 163, fwdColor, 916);
    drawArrow(rc, g, 268, 163, 323, 163, fwdColor, 918);
    drawArrow(rc, g, 434, 172, 493, 126, fwdColor, 920);

    if (step >= 1) {
      drawArrow(rc, g, 493, 114, 434, 68, green, 922, true);
      drawArrow(rc, g, 493, 136, 434, 184, coral, 924, true);
    }
    if (step >= 2) {
      drawArrow(rc, g, 323, 66, 268, 66, green, 926, true);
      drawArrow(rc, g, 323, 182, 268, 182, coral, 928, true);
    }
    if (step >= 3) {
      drawArrow(rc, g, 161, 66, 108, 66, green, 930, true);
      drawArrow(rc, g, 161, 182, 108, 182, coral, 932, true);
    }
  }, [step]);

  return (
    <figure className="blog-figure" style={{ padding: '24px 16px 18px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 636 244"
        width="100%"
        style={{ display: 'block', maxWidth: 636, overflow: 'visible' }}
        role="img"
        aria-label="双参数计算图前向求值与反向传播导数示意图"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <text x="62" y="62" textAnchor="middle" fill={blue} fontSize="20" className="chalk-title">
          θ₁ = 2
        </text>
        <text x="62" y="178" textAnchor="middle" fill={blue} fontSize="20" className="chalk-title">
          θ₂ = 0
        </text>

        <text x="215" y="22" textAnchor="middle" fill="var(--lab-muted)" fontSize="16" className="chalk-title">
          θ₁ - 3
        </text>
        <text x="215" y="62" textAnchor="middle" fill={white} fontSize="20" className="chalk-title">
          a = -1
        </text>

        <text x="215" y="138" textAnchor="middle" fill="var(--lab-muted)" fontSize="16" className="chalk-title">
          θ₂ - 2
        </text>
        <text x="215" y="178" textAnchor="middle" fill={white} fontSize="20" className="chalk-title">
          b = -2
        </text>

        <text x="379" y="62" textAnchor="middle" fill={white} fontSize="20" className="chalk-title">
          -a² = -1
        </text>
        <text x="379" y="178" textAnchor="middle" fill={white} fontSize="20" className="chalk-title">
          -b² = -4
        </text>

        <text x="557" y="74" textAnchor="middle" fill="var(--lab-muted)" fontSize="16" className="chalk-title">
          -a² - b² + 10
        </text>
        <text x="557" y="122" textAnchor="middle" fill={yellow} fontSize="24" className="chalk-title">
          J = 5
        </text>

        <text
          x="466"
          y="108"
          textAnchor="middle"
          fill={green}
          fontSize="17"
          className="chalk-title"
          style={{ opacity: step >= 1 ? 1 : 0.15, transition: 'opacity 280ms ease' }}
        >
          ×1
        </text>
        <text
          x="466"
          y="174"
          textAnchor="middle"
          fill={coral}
          fontSize="17"
          className="chalk-title"
          style={{ opacity: step >= 1 ? 1 : 0.15, transition: 'opacity 280ms ease' }}
        >
          ×1
        </text>

        <text
          x="295"
          y="88"
          textAnchor="middle"
          fill={green}
          fontSize="17"
          className="chalk-title"
          style={{ opacity: step >= 2 ? 1 : 0.15, transition: 'opacity 280ms ease' }}
        >
          ×2
        </text>
        <text
          x="295"
          y="204"
          textAnchor="middle"
          fill={coral}
          fontSize="17"
          className="chalk-title"
          style={{ opacity: step >= 2 ? 1 : 0.15, transition: 'opacity 280ms ease' }}
        >
          ×4
        </text>

        <text
          x="135"
          y="88"
          textAnchor="middle"
          fill={green}
          fontSize="17"
          className="chalk-title"
          style={{ opacity: step >= 3 ? 1 : 0.15, transition: 'opacity 280ms ease' }}
        >
          ×1
        </text>
        <text
          x="135"
          y="204"
          textAnchor="middle"
          fill={coral}
          fontSize="17"
          className="chalk-title"
          style={{ opacity: step >= 3 ? 1 : 0.15, transition: 'opacity 280ms ease' }}
        >
          ×1
        </text>

        <text
          x="62"
          y="106"
          textAnchor="middle"
          fill={green}
          fontSize="18"
          className="chalk-title"
          style={{ opacity: step >= 3 ? 1 : 0.18, transition: 'opacity 280ms ease' }}
        >
          ∂J/∂θ₁ = +2
        </text>
        <text
          x="62"
          y="224"
          textAnchor="middle"
          fill={coral}
          fontSize="18"
          className="chalk-title"
          style={{ opacity: step >= 3 ? 1 : 0.18, transition: 'opacity 280ms ease' }}
        >
          ∂J/∂θ₂ = +4
        </text>
      </svg>
    </figure>
  );
}
