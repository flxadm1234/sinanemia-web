"use client";

import { useState } from "react";
import { FullScreenLoader } from "@/components/FullScreenLoader";

export function DownloadIconButton(props: {
  href: string;
  filename: string;
  overlayLabel?: string;
  className?: string;
  title?: string;
}) {
  const { href, filename, overlayLabel, className, title } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(href, { method: "GET" });
      if (!res.ok) {
        let msg = "No se pudo descargar el archivo.";
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
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {loading ? <FullScreenLoader label={overlayLabel ?? "Descargando..."} /> : null}
      <button
        type="button"
        title={title ?? "Descargar"}
        aria-label={title ?? "Descargar"}
        className={
          className ??
          "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-60"
        }
        onClick={onClick}
        disabled={loading}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 2a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4.004 4.004a1 1 0 0 1-1.414 0L5.286 9.707A1 1 0 0 1 6.7 8.293L9 10.586V3a1 1 0 0 1 1-1Z" />
          <path d="M3 14a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z" />
          <path d="M4 16a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
        </svg>
      </button>
      {error ? <div className="text-right text-[11px] text-red-700">{error}</div> : null}
    </div>
  );
}

