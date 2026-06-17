"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DestinatarioRow = {
  id: number;
  ubigeo: string;
  nombre: string | null;
  cargo: string | null;
  activo: number;
  orden: number;
  created_at: string;
  updated_at: string;
};

function fmtDateTime(v: unknown) {
  const d = new Date(String(v ?? ""));
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { hour12: false });
}

function normalizeUbigeo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

export function InformeDestinatariosClient(props: {
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
  ubigeos: number[];
}) {
  const { role, sessionUbigeo, ubigeos } = props;

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [filterUbigeo, setFilterUbigeo] = useState("");

  const [rows, setRows] = useState<DestinatarioRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formUbigeo, setFormUbigeo] = useState(role === "SUPER ADMIN" ? "" : normalizeUbigeo(sessionUbigeo));
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [orden, setOrden] = useState("1");
  const [activo, setActivo] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const qDebounce = useRef<any>(null);
  const qStable = useRef("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, (page - 1) * pageSize + rows.length);

  const ubigeoOptions = useMemo(() => {
    return (Array.isArray(ubigeos) ? ubigeos : [])
      .map((n) => normalizeUbigeo(n))
      .filter((x) => /^\d{6}$/.test(x));
  }, [ubigeos]);

  const resetForm = () => {
    setMode("create");
    setEditingId(null);
    setFormUbigeo(role === "SUPER ADMIN" ? "" : normalizeUbigeo(sessionUbigeo));
    setNombre("");
    setCargo("");
    setOrden("1");
    setActivo(true);
    setSaveError("");
  };

  const load = async (params: { q: string; page: number; ubigeo: string }) => {
    setLoadingList(true);
    setListError("");
    try {
      const sp = new URLSearchParams();
      if (params.q.trim()) sp.set("q", params.q.trim());
      sp.set("page", String(params.page));
      sp.set("pageSize", String(pageSize));
      if (role === "SUPER ADMIN" && params.ubigeo.trim()) sp.set("ubigeo", normalizeUbigeo(params.ubigeo.trim()));
      const res = await fetch(`/api/informe-destinatarios?${sp.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo listar"));
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
      load({ q, page: 1, ubigeo: filterUbigeo });
    }, 250);
    return () => {
      if (qDebounce.current) clearTimeout(qDebounce.current);
    };
  }, [q, filterUbigeo]);

  useEffect(() => {
    load({ q: qStable.current, page, ubigeo: filterUbigeo });
  }, [page]);

  const startEdit = (r: DestinatarioRow) => {
    setMode("edit");
    setEditingId(r.id);
    setFormUbigeo(String(r.ubigeo ?? ""));
    setNombre(String(r.nombre ?? ""));
    setCargo(String(r.cargo ?? ""));
    setOrden(String(r.orden ?? 1));
    setActivo(Number(r.activo ?? 0) === 1);
    setSaveError("");
  };

  const onSave = async () => {
    setSaveError("");
    if (role === "SUPER ADMIN") {
      const u = normalizeUbigeo(formUbigeo);
      if (!u) {
        setSaveError("Selecciona un ubigeo.");
        return;
      }
      setFormUbigeo(u);
    }
    if (!nombre.trim()) {
      setSaveError("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      if (role === "SUPER ADMIN") fd.append("ubigeo", normalizeUbigeo(formUbigeo));
      fd.append("nombre", nombre);
      fd.append("cargo", cargo);
      fd.append("orden", orden);
      fd.append("activo", activo ? "1" : "0");

      const url = mode === "edit" && editingId ? `/api/informe-destinatarios/${editingId}` : "/api/informe-destinatarios";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo guardar"));
      resetForm();
      await load({ q: qStable.current, page: 1, ubigeo: filterUbigeo });
      setPage(1);
    } catch (e: any) {
      setSaveError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("¿Eliminar este destinatario? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    setListError("");
    try {
      const res = await fetch(`/api/informe-destinatarios/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo eliminar"));
      await load({ q: qStable.current, page, ubigeo: filterUbigeo });
    } catch (e: any) {
      setListError(String(e?.message ?? e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
      {saveError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{saveError}</div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Destinatarios del informe</div>
          <div className="mt-1 text-sm text-zinc-600">Registra a quién va dirigido el informe (obligatorio).</div>
        </div>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancelar
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
          <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
          {role === "SUPER ADMIN" ? (
            <input
              type="text"
              value={formUbigeo}
              onChange={(e) => setFormUbigeo(e.target.value)}
              placeholder="Ej: 160301"
              list="ubigeo-options-dest"
              className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              disabled={saving}
            />
          ) : (
            <input
              type="text"
              value={normalizeUbigeo(sessionUbigeo)}
              readOnly
              className="mt-2 block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
            />
          )}
          <datalist id="ubigeo-options-dest">
            {ubigeoOptions.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="mt-2 text-xs text-zinc-500">Se guarda por distrito.</div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-white ring-1 ring-black/5 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Ej: Lic. María Pérez Gómez"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Cargo</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Ej: Gerente de Desarrollo Social"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Orden</label>
              <input
                type="number"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                min={1}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between gap-3 md:pt-7">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-900">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} disabled={saving} />
                Activo
              </label>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {mode === "edit" ? "Guardar cambios" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {listError ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{listError}</div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="text-xs text-zinc-500">
          Mostrando {from}–{to} de {total}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {role === "SUPER ADMIN" ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700">Ubigeo</label>
              <input
                type="text"
                value={filterUbigeo}
                onChange={(e) => setFilterUbigeo(e.target.value)}
                placeholder="Todos"
                list="ubigeo-options-dest"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-zinc-700">Búsqueda</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre/cargo..."
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold text-zinc-700">
            <tr>
              <th className="px-4 py-3">Ubigeo</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Actualizado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loadingList ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-600">
                  Cargando...
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((r) => (
                <tr key={r.id} className="text-zinc-900">
                  <td className="px-4 py-3 font-mono">{r.ubigeo}</td>
                  <td className="px-4 py-3">{r.nombre || "—"}</td>
                  <td className="px-4 py-3">{r.cargo || "—"}</td>
                  <td className="px-4 py-3">{Number(r.activo) === 1 ? "SI" : "NO"}</td>
                  <td className="px-4 py-3">{Number(r.orden ?? 1)}</td>
                  <td className="px-4 py-3">{fmtDateTime(r.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletingId === r.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-600">
                  No hay destinatarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          Página {page} de {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

