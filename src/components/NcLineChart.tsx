"use client";

import { useMemo, useState } from "react";

export type NcLinePoint = {
  label: string;
  denom: number;
  numer: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function formatNum(n: number) {
  return new Intl.NumberFormat("es-PE").format(n);
}

export function NcLineChart(props: {
  points: NcLinePoint[];
  target?: number;
  title?: string;
  subtitle?: string;
}) {
  const points = props.points ?? [];
  const target = Number(props.target ?? NaN);
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const w = 880;
    const h = 240;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 44;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const values = points.map((p) => pct(p.numer, p.denom));
    const maxV = Math.max(10, ...values, Number.isFinite(target) ? target : 0, 0);
    const topV = Math.min(100, Math.ceil(maxV / 10) * 10);

    const xAt = (i: number) => {
      if (points.length <= 1) return padL + innerW / 2;
      return padL + (innerW * i) / (points.length - 1);
    };
    const yAt = (v: number) => {
      const t = v / topV;
      return padT + (1 - t) * innerH;
    };

    const buildPath = () => {
      if (!points.length) return "";
      return points
        .map((p, i) => {
          const v = pct(p.numer, p.denom);
          return `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
        })
        .join(" ");
    };

    const linePath = buildPath();
    const yTicks = [0, 25, 50, 60, 75, 100].filter((t) => t <= topV);
    const grid = yTicks.map((v) => ({ v, y: yAt(v) }));
    return { w, h, padL, padR, padT, padB, innerW, innerH, topV, xAt, yAt, linePath, grid };
  }, [points, target]);

  const hoverIdx = hover == null ? null : clamp(Math.round(hover), 0, Math.max(0, points.length - 1));
  const hp = hoverIdx == null ? null : points[hoverIdx];

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">
            {props.title ?? "Cumplimiento NC (tamizaje) por mes"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {props.subtitle ??
              "Línea = % (Numerador / Denominador) según reglas de edad, permanencia, seguro y tamizaje."}
          </div>
        </div>
        <div className="text-xs text-zinc-600">
          {hp ? (
            <>
              <span className="font-semibold text-zinc-900">{hp.label}</span>
              {" · "}
              {pct(hp.numer, hp.denom)}% (N {formatNum(hp.numer)} / NC {formatNum(hp.denom)})
            </>
          ) : (
            <>
              {Number.isFinite(target) ? (
                <>
                  Meta: <span className="font-semibold text-red-700">{target}%</span>
                </>
              ) : (
                "Meta no configurada"
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <svg
            viewBox={`0 0 ${chart.w} ${chart.h}`}
            className="h-[240px] w-full"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const t = (x / rect.width) * chart.w;
              const innerX = clamp(t - chart.padL, 0, chart.innerW);
              const idx = points.length <= 1 ? 0 : (innerX / chart.innerW) * (points.length - 1);
              setHover(idx);
            }}
          >
            {chart.grid.map((g) => (
              <g key={g.v}>
                <line
                  x1={chart.padL}
                  x2={chart.w - chart.padR}
                  y1={g.y}
                  y2={g.y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                />
                <text
                  x={chart.padL - 8}
                  y={g.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#6B7280"
                >
                  {g.v}%
                </text>
              </g>
            ))}

            {Number.isFinite(target) ? (
              <>
                <line
                  x1={chart.padL}
                  x2={chart.w - chart.padR}
                  y1={chart.yAt(target)}
                  y2={chart.yAt(target)}
                  stroke="#DC2626"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x={chart.w - chart.padR}
                  y={chart.yAt(target) - 6}
                  textAnchor="end"
                  fontSize="11"
                  fill="#B91C1C"
                >
                  Meta {target}%
                </text>
              </>
            ) : null}

            <path d={chart.linePath} fill="none" stroke="#7C3AED" strokeWidth="2.5" />

            <g>
              {points.map((p, i) => {
                const v = pct(p.numer, p.denom);
                const x = chart.xAt(i);
                const y = chart.yAt(v);
                return (
                  <g key={`${p.label}-val`}>
                    <circle cx={x} cy={y} r="3.5" fill="#7C3AED" />
                    <text x={x} y={y - 8} textAnchor="middle" fontSize="11" fill="#111827">
                      {v}%
                    </text>
                  </g>
                );
              })}
            </g>

            {hoverIdx != null && points.length ? (
              <>
                <line
                  x1={chart.xAt(hoverIdx)}
                  x2={chart.xAt(hoverIdx)}
                  y1={chart.padT}
                  y2={chart.padT + chart.innerH}
                  stroke="#111827"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                />
              </>
            ) : null}

            <g>
              {points.map((p, i) => (
                <text
                  key={p.label}
                  x={chart.xAt(i)}
                  y={chart.h - 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6B7280"
                >
                  {p.label}
                </text>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

