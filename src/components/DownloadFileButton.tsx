"use client";

import { useState } from "react";
import { FullScreenLoader } from "@/components/FullScreenLoader";

export function DownloadFileButton(props: {
  href: string;
  filename: string;
  label: string;
  overlayLabel?: string;
  className?: string;
}) {
  const { href, filename, label, overlayLabel, className } = props;
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
    <div className="flex flex-col items-start gap-2">
      {loading ? <FullScreenLoader label={overlayLabel ?? "Descargando..."} /> : null}
      <button type="button" className={className} onClick={onClick} disabled={loading}>
        {loading ? "Descargando..." : label}
      </button>
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}

