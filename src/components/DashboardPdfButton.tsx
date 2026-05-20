"use client";

import { useMemo, useState } from "react";

type Payload = {
  scopeUbigeo: string;
  etapa: string;
  periodoLabel: string;
  userLabel: string;
  role: string;
  totals?: { total: number; assigned: number };
  nc?: {
    denom: number;
    numer: number;
    pct: number;
    meta?: number;
  };
  visitas?: {
    denom: number;
    numer: number;
    pct: number;
    meta?: number;
  };
  charts: Array<{ key: string; title: string; svgId: string }>;
};

function svgToPngDataUrl(svgEl: SVGSVGElement, scale = 2): Promise<string> {
  const vb = svgEl.viewBox?.baseVal;
  const w = vb?.width ? vb.width : svgEl.clientWidth || 800;
  const h = vb?.height ? vb.height : svgEl.clientHeight || 240;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  const serializer = new XMLSerializer();
  const svg = serializer.serializeToString(clone);

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No se pudo crear canvas");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/png");
        resolve(out);
      } catch (e) {
        reject(new Error("No se pudo convertir el gráfico a imagen. Intenta recargar el Dashboard y vuelve a generar el PDF."));
      }
    };
    img.onerror = () => {
      reject(new Error("No se pudo renderizar el gráfico como imagen. Intenta recargar el Dashboard y vuelve a generar el PDF."));
    };
    img.src = url;
  });
}

export function DashboardPdfButton(props: { payload: Payload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canGenerate = useMemo(() => {
    return Boolean(props.payload?.scopeUbigeo && props.payload?.etapa);
  }, [props.payload]);

  const onClick = async () => {
    if (!canGenerate) return;
    setError("");
    setLoading(true);
    try {
      const charts: Array<{ key: string; title: string; pngDataUrl: string }> = [];
      for (const c of props.payload.charts) {
        const el = document.getElementById(c.svgId);
        if (!(el instanceof SVGSVGElement)) continue;
        const png = await svgToPngDataUrl(el, 2);
        charts.push({ key: c.key, title: c.title, pngDataUrl: png });
      }

      const body = {
        ...props.payload,
        charts,
      };

      const res = await fetch("/api/reportes/dashboard-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = "No se pudo generar el PDF.";
        try {
          const data = await res.json();
          msg = data?.error ? String(data.error) : msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_dashboard_${props.payload.scopeUbigeo}_${props.payload.etapa}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={!canGenerate || loading}
        onClick={onClick}
        className="inline-flex items-center justify-center rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
      >
        {loading ? "Generando PDF..." : "Descargar informe PDF"}
      </button>
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}

