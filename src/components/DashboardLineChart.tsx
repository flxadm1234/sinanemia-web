"use client";

import { useMemo, useState } from "react";

export type DashboardLinePoint = {
  label: string;
  total: number;
  assigned: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatNum(n: number) {
  return new Intl.NumberFormat("es-PE").format(n);
}

export function DashboardLineChart(props: { points: DashboardLinePoint[] }) {
  const points = props.points ?? [];
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const w = 880;
    const h = 260;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 44;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const maxV = Math.max(
      1,
      ...points.map((p) => p.total),
      ...points.map((p) => p.assigned),
    );

    const xAt = (i: number) => {
      if (points.length <= 1) return padL + innerW / 2;
      return padL + (innerW * i) / (points.length - 1);
    };
    const yAt = (v: number) => {
      const t = v / maxV;
      return padT + (1 - t) * innerH;
    };

    const buildPath = (series: (p: DashboardLinePoint) => number) => {
      if (!points.length) return "";
      return points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(series(p)).toFixed(1)}`)
        .join(" ");
    };

    const totalPath = buildPath((p) => p.total);
    const assignedPath = buildPath((p) => p.assigned);

    const yTicks = [0.25, 0.5, 0.75, 1].map((t) => Math.round(maxV * t));
    const grid = yTicks.map((v) => ({ v, y: yAt(v) }));

    return { w, h, padL, padR, padT, padB, innerW, innerH, maxV, xAt, yAt, totalPath, assignedPath, grid };
  }, [points]);

  const hoverIdx = hover == null ? null : clamp(Math.round(hover), 0, Math.max(0, points.length - 1));
  const hp = hoverIdx == null ? null : points[hoverIdx];

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Niños cargados vs asignados</div>
          <div className="mt-1 text-xs text-zinc-500">
            Línea por mes (cargados) y asignados en tu alcance.
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" />
            <span className="text-zinc-600">Cargados</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span className="text-zinc-600">Asignados</span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <svg
            viewBox={`0 0 ${chart.w} ${chart.h}`}
            className="h-[260px] w-full"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const t = (x / rect.width) * chart.w;
              const innerX = clamp(t - chart.padL, 0, chart.innerW);
              const idx =
                points.length <= 1 ? 0 : (innerX / chart.innerW) * (points.length - 1);
              setHover(idx);
            }}
          >
            <defs>
              <linearGradient id="totalFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="assignedFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {chart.grid.map((g) => (
              <g key={g.v}>
                <line x1={chart.padL} x2={chart.w - chart.padR} y1={g.y} y2={g.y} stroke="#E5E7EB" strokeWidth="1" />
                <text x={chart.padL - 8} y={g.y + 4} textAnchor="end" fontSize="11" fill="#6B7280">
                  {formatNum(g.v)}
                </text>
              </g>
            ))}

            <line
              x1={chart.padL}
              x2={chart.w - chart.padR}
              y1={chart.padT + chart.innerH}
              y2={chart.padT + chart.innerH}
              stroke="#E5E7EB"
              strokeWidth="1"
            />

            {points.length ? (
              <>
                <path
                  d={`${chart.totalPath} L ${chart.xAt(points.length - 1)} ${chart.padT + chart.innerH} L ${chart.xAt(0)} ${chart.padT + chart.innerH} Z`}
                  fill="url(#totalFill)"
                />
                <path
                  d={`${chart.assignedPath} L ${chart.xAt(points.length - 1)} ${chart.padT + chart.innerH} L ${chart.xAt(0)} ${chart.padT + chart.innerH} Z`}
                  fill="url(#assignedFill)"
                />
                <path d={chart.totalPath} fill="none" stroke="#4F46E5" strokeWidth="2.5" />
                <path d={chart.assignedPath} fill="none" stroke="#059669" strokeWidth="2.5" />
              </>
            ) : null}

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
                <circle cx={chart.xAt(hoverIdx)} cy={chart.yAt(points[hoverIdx].total)} r="4" fill="#4F46E5" />
                <circle cx={chart.xAt(hoverIdx)} cy={chart.yAt(points[hoverIdx].assigned)} r="4" fill="#059669" />
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

          {hp ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-semibold text-zinc-900">{hp.label}</div>
                <div className="text-zinc-700">
                  Cargados: <span className="font-semibold">{formatNum(hp.total)}</span> · Asignados:{" "}
                  <span className="font-semibold">{formatNum(hp.assigned)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

