"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ArchivoUpload = {
  id: number;
  original_name: string;
  stored_name: string;
  ext: string | null;
  mime_type: string | null;
  size_bytes: number;
  title: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

function fmtDateTime(v: unknown) {
  const d = new Date(String(v ?? ""));
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { hour12: false });
}

function fmtSize(bytes: number) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function fileBadge(extRaw: string | null) {
  const ext = String(extRaw ?? "").trim().toLowerCase();
  const key = ext || "file";
  if (key === "pdf") return { label: "PDF", cls: "bg-red-50 text-red-700 ring-red-200" };
  if (key === "xls" || key === "xlsx")
    return { label: "XLS", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (key === "doc" || key === "docx")
    return { label: "DOC", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (key === "ppt" || key === "pptx")
    return { label: "PPT", cls: "bg-orange-50 text-orange-700 ring-orange-200" };
  if (key === "png" || key === "jpg" || key === "jpeg" || key === "gif" || key === "webp")
    return { label: "IMG", cls: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" };
  if (key === "zip" || key === "rar" || key === "7z")
    return { label: "ZIP", cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
  if (key === "csv") return { label: "CSV", cls: "bg-teal-50 text-teal-700 ring-teal-200" };
  if (key === "txt") return { label: "TXT", cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
  return { label: (key || "FILE").slice(0, 4).toUpperCase(), cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
}

export function ArchivosManagerClient() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [rows, setRows] = useState<ArchivoUpload[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const qDebounce = useRef<any>(null);
  const qStable = useRef("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, (page - 1) * pageSize + rows.length);

  const load = async (params: { q: string; page: number }) => {
    setLoadingList(true);
    setListError("");
    try {
      const sp = new URLSearchParams();
      if (params.q.trim()) sp.set("q", params.q.trim());
      sp.set("page", String(params.page));
      sp.set("pageSize", String(pageSize));
      const res = await fetch(`/api/archivos?${sp.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo listar archivos"));
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total ?? 0));
    } catch (e: any) {
      setListError(String(e?.message ?? e));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (qDebounce.current) clearTimeout(qDebounce.current);
    qDebounce.current = setTimeout(() => {
      qStable.current = q;
      setPage(1);
      load({ q, page: 1 });
    }, 250);
    return () => {
      if (qDebounce.current) clearTimeout(qDebounce.current);
    };
  }, [q]);

  useEffect(() => {
    load({ q: qStable.current, page });
  }, [page]);

  const onUpload = async () => {
    setUploadError("");
    if (!file) {
      setUploadError("Selecciona un archivo.");
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);

      const xhr = new XMLHttpRequest();
      const p = await new Promise<any>((resolve, reject) => {
        xhr.open("POST", "/api/archivos");
        xhr.responseType = "json";
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setUploadPct(Math.max(0, Math.min(100, pct)));
        };
        xhr.onload = () => {
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (!ok) {
            const err = (xhr.response as any)?.error || xhr.statusText || "Error subiendo archivo";
            reject(new Error(String(err)));
            return;
          }
          resolve(xhr.response);
        };
        xhr.onerror = () => reject(new Error("Error de red subiendo archivo"));
        xhr.send(fd);
      });

      if (!p?.row) throw new Error(String(p?.error || "No se pudo registrar el archivo"));
      setFile(null);
      setTitle("");
      setUploadPct(100);
      await load({ q: qStable.current, page: 1 });
      setPage(1);
    } catch (e: any) {
      setUploadError(String(e?.message ?? e));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadPct(0), 600);
    }
  };

  const startEdit = (r: ArchivoUpload) => {
    setEditingId(r.id);
    setEditingTitle(String(r.title ?? ""));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const saveEdit = async (id: number) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/archivos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo actualizar"));
      setEditingId(null);
      setEditingTitle("");
      await load({ q: qStable.current, page });
    } catch (e: any) {
      setListError(String(e?.message ?? e));
    } finally {
      setSavingEdit(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("¿Eliminar este archivo? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/archivos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo eliminar"));
      await load({ q: qStable.current, page });
    } catch (e: any) {
      setListError(String(e?.message ?? e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        {uploadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {uploadError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-900">Archivo</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
              disabled={uploading}
            />
            {file ? <div className="mt-1 text-xs text-zinc-500">Seleccionado: {file.name}</div> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900">Nombre (opcional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: Directiva 2026, etc."
              disabled={uploading}
            />
          </div>
        </div>

        {uploading || uploadPct ? (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-blue-700" style={{ width: `${uploadPct}%` }} />
            </div>
            <div className="mt-2 text-xs text-zinc-600">{uploading ? `Subiendo... ${uploadPct}%` : ""}</div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onUpload}
            disabled={uploading}
            className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {uploading ? "Cargando..." : "Cargar archivo"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        {listError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {listError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Archivos cargados</div>
            <div className="mt-1 text-sm text-zinc-600">
              {loadingList ? "Cargando..." : `Mostrando ${from}–${to} de ${total}`}
            </div>
          </div>
          <div className="w-full sm:w-96">
            <label className="block text-sm font-medium text-zinc-900">Búsqueda</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Buscar por nombre..."
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold">Título</th>
                <th className="px-4 py-3 text-right font-semibold">Tamaño</th>
                <th className="px-4 py-3 text-left font-semibold">Cargado</th>
                <th className="px-4 py-3 text-left font-semibold">Descargar</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.length ? (
                rows.map((r) => {
                  const badge = fileBadge(r.ext);
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="text-zinc-900">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.original_name}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            placeholder="(opcional)"
                          />
                        ) : (
                          <span className="text-zinc-800">{r.title || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{fmtSize(Number(r.size_bytes ?? 0))}</td>
                      <td className="px-4 py-3">{fmtDateTime(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`/api/archivos/${r.id}/download`}
                          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Descargar
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingEdit}
                                onClick={() => saveEdit(r.id)}
                                className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                disabled={savingEdit}
                                onClick={cancelEdit}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(r)}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === r.id}
                                onClick={() => onDelete(r.id)}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                {deletingId === r.id ? "Eliminando..." : "Eliminar"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={7}>
                    {loadingList ? "Cargando..." : "No hay archivos."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-zinc-600">
            Página {page} de {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loadingList}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                page <= 1 || loadingList
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loadingList}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                page >= totalPages || loadingList
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

