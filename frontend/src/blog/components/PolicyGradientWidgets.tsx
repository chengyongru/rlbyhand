import { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';
import { CHALK_COLORS } from '../types';

const { white, yellow, blue, green, coral } = CHALK_COLORS;

const TOKENS = [
  { label: '3', prob: '0.5', color: blue },
  { label: '*', prob: '0.6', color: yellow },
  { label: '7', prob: '0.8', color: green },
];

export function TokenChainSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    g.appendChild(
      rc.rectangle(16, 42, 114, 54, {
        stroke: 'rgba(235, 231, 220, 0.5)',
        strokeWidth: 1.8,
        roughness: 1.8,
        seed: 701,
      })
    );

    const centers = [204, 316, 428];
    centers.forEach((cx, i) => {
      const x1 = i === 0 ? 134 : centers[i - 1] + 30;
      const x2 = cx - 32;
      g.appendChild(
        rc.line(x1, 69, x2, 69, {
          stroke: TOKENS[i].color,
          strokeWidth: 2,
          roughness: 1.7,
          seed: 710 + i,
        })
      );
      g.appendChild(
        rc.linearPath(
          [
            [x2 - 9, 63],
            [x2 + 1, 69],
            [x2 - 9, 75],
          ],
          { stroke: TOKENS[i].color, strokeWidth: 2, roughness: 1.4, seed: 720 + i }
        )
      );
      g.appendChild(
        rc.circle(cx, 69, 54, {
          stroke: TOKENS[i].color,
          strokeWidth: 2.2,
          fill: 'rgba(235, 231, 220, 0.05)',
          fillStyle: 'hachure',
          hachureGap: 8,
          roughness: 1.9,
          seed: 730 + i,
        })
      );
    });

    g.appendChild(
      rc.line(460, 69, 492, 69, {
        stroke: 'rgba(235, 231, 220, 0.45)',
        strokeWidth: 1.6,
        strokeLineDash: [5, 4],
        roughness: 1.5,
        seed: 740,
      })
    );
    g.appendChild(
      rc.rectangle(496, 32, 128, 74, {
        stroke: yellow,
        strokeWidth: 2.1,
        fill: 'rgba(224, 192, 104, 0.09)',
        fillStyle: 'hachure',
        hachureGap: 9,
        roughness: 1.9,
        seed: 741,
      })
    );
  }, []);

  return (
    <figure className="blog-figure" style={{ padding: '22px 18px 18px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 640 162"
        width="100%"
        style={{ display: 'block', maxWidth: 640, overflow: 'visible' }}
        role="img"
        aria-label="逐词条件概率连乘取对数变连加"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <text x="73" y="64" textAnchor="middle" fill="var(--lab-muted)" fontSize="18" className="chalk-title">
          题目 x
        </text>
        <text x="73" y="86" textAnchor="middle" fill={white} fontSize="18" className="chalk-title">
          [3, 7, 12]
        </text>

        {TOKENS.map((tok, i) => {
          const cx = [204, 316, 428][i];
          return (
            <g key={tok.label}>
              <text x={cx} y="77" textAnchor="middle" fill={white} fontSize="26" className="chalk-title">
                {tok.label}
              </text>
              <text x={cx} y="122" textAnchor="middle" fill={tok.color} fontSize="18" className="chalk-title">
                p{i + 1} = {tok.prob}
              </text>
            </g>
          );
        })}

        <text x="560" y="60" textAnchor="middle" fill={yellow} fontSize="19" className="chalk-title">
          P = 0.24
        </text>
        <text x="560" y="89" textAnchor="middle" fill={blue} fontSize="19" className="chalk-title">
          ln P = -1.43
        </text>

        <text x="320" y="153" textAnchor="middle" fill="var(--lab-muted)" fontSize="18" className="chalk-title">
          连乘 0.5 × 0.6 × 0.8 取对数后变成连加 ln(0.5) + ln(0.6) + ln(0.8)
        </text>
      </svg>
    </figure>
  );
}

export function ReinforceDirectionSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [goodTurn, setGoodTurn] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGoodTurn((v) => !v);
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const g = layerRef.current;
    if (!svg || !g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    const rc = rough.svg(svg);

    g.appendChild(
      rc.rectangle(24, 24, 276, 112, {
        stroke: green,
        strokeWidth: goodTurn ? 2.4 : 1.5,
        fill: 'rgba(133, 184, 148, 0.1)',
        fillStyle: 'hachure',
        hachureGap: 10,
        roughness: 1.9,
        seed: 801,
      })
    );

    g.appendChild(
      rc.rectangle(340, 24, 276, 112, {
        stroke: 'rgba(235, 231, 220, 0.45)',
        strokeWidth: goodTurn ? 1.5 : 2.3,
        fill: 'rgba(235, 231, 220, 0.04)',
        fillStyle: 'hachure',
        hachureGap: 11,
        roughness: 1.9,
        seed: 802,
      })
    );

    g.appendChild(
      rc.line(250, 108, 250, 56, {
        stroke: green,
        strokeWidth: 2.6,
        roughness: 1.6,
        seed: 803,
      })
    );
    g.appendChild(
      rc.linearPath(
        [
          [242, 68],
          [250, 54],
          [258, 68],
        ],
        { stroke: green, strokeWidth: 2.6, roughness: 1.4, seed: 804 }
      )
    );
  }, [goodTurn]);

  return (
    <figure className="blog-figure" style={{ padding: '24px 20px 20px' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 640 160"
        width="100%"
        style={{ display: 'block', maxWidth: 640, overflow: 'visible' }}
        role="img"
        aria-label="R等于1拉高概率与R等于0梯度归零对比"
      >
        <g ref={layerRef} style={{ filter: 'url(#chalk-stroke-filter)' }} />

        <g style={{ opacity: goodTurn ? 1 : 0.65, transition: 'opacity 320ms ease' }}>
          <text x="48" y="58" fill={green} fontSize="25" className="chalk-title">
            R(y) = 1
          </text>
          <text x="48" y="88" fill={white} fontSize="20" className="chalk-title">
            L = -ln Pθ(y | x)
          </text>
          <text x="48" y="118" fill="var(--lab-muted)" fontSize="18" className="chalk-title">
            最小化 L，拉高这条回答的概率
          </text>
        </g>

        <g style={{ opacity: goodTurn ? 0.65 : 1, transition: 'opacity 320ms ease' }}>
          <text x="364" y="58" fill={coral} fontSize="25" className="chalk-title">
            R(y) = 0
          </text>
          <text x="364" y="88" fill={white} fontSize="20" className="chalk-title">
            L = 0
          </text>
          <text x="364" y="118" fill="var(--lab-muted)" fontSize="18" className="chalk-title">
            梯度为 0，这条错答案原地不动
          </text>
        </g>
      </svg>
    </figure>
  );
}
