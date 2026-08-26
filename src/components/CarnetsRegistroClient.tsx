"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CarnetListadoRow = {
  idpn: number;
  dni: string | null;
  nombres: string | null;
  img_carnet: string | null;
  estado_verificacion: string | null;
};

type CarnetCounters = {
  total: number;
  confirmados: number;
  pendientes: number;
};

type PadronCarnet = {
  idpn: number;
  dni: string | null;
  nombres: string | null;
  etapa: string | null;
  fecha_nac: string | null;
  img_carnet: string | null;
  estado_verificacion: string | null;
};

type RegistroHemoglobinaRow = {
  id: number;
  dni_extraido: string | null;
  dni_consultado: string | null;
  fecha_examen: string | null;
  edad: string | null;
  resultado: string | null;
  tipo: number | null;
};

type StatusFilter = "pendiente" | "confirmado" | "all";

function estadoBadge(estadoRaw: unknown) {
  const estado = String(estadoRaw ?? "").trim().toLowerCase();
  if (estado === "confirmado")
    return { label: "Confirmado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  return { label: "Pendiente", cls: "bg-amber-50 text-amber-800 ring-amber-200" };
}

function fmtDate(v: unknown) {
  const s = String(v ?? "").slice(0, 10);
  if (!s.trim()) return "—";
  return s;
}

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

export function CarnetsRegistroClient() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pendiente");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [rows, setRows] = useState<CarnetListadoRow[]>([]);
  const [counters, setCounters] = useState<CarnetCounters>({ total: 0, confirmados: 0, pendientes: 0 });
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  const [selectedIdpn, setSelectedIdpn] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [padron, setPadron] = useState<PadronCarnet | null>(null);
  const [registros, setRegistros] = useState<RegistroHemoglobinaRow[]>([]);

  const [savingEstado, setSavingEstado] = useState(false);

  const [imgScale, setImgScale] = useState(1);
  const [imgRotate, setImgRotate] = useState(0);
  const [imgX, setImgX] = useState(0);
  const [imgY, setImgY] = useState(0);
  const dragging = useRef(false);
  const dragLast = useRef<{ x: number; y: number } | null>(null);

  const [addingTipo1, setAddingTipo1] = useState(false);
  const [newFecha1, setNewFecha1] = useState("");
  const [newEdad1, setNewEdad1] = useState("");
  const [newResultado1, setNewResultado1] = useState("");

  const [addingTipo2, setAddingTipo2] = useState(false);
  const [newFecha2, setNewFecha2] = useState("");
  const [newEdad2, setNewEdad2] = useState("");
  const [newResultado2, setNewResultado2] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFecha, setEditingFecha] = useState("");
  const [editingEdad, setEditingEdad] = useState("");
  const [editingResultado, setEditingResultado] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const qDebounce = useRef<any>(null);
  const qStable = useRef("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil((counters?.total ?? 0) / pageSize)), [counters, pageSize]);
  const from = counters.total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(counters.total, (page - 1) * pageSize + rows.length);

  const loadList = async (params: { q: string; status: StatusFilter; page: number }) => {
    setLoadingList(true);
    setListError("");
    try {
      const sp = new URLSearchParams();
      const qq = params.q.trim();
      if (qq) sp.set("search", qq);
      sp.set("status", params.status);
      sp.set("page", String(params.page));
      const res = await fetch(`/api/carnets?${sp.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo listar carnets"));
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setCounters(
        data?.counters && typeof data?.counters === "object"
          ? {
              total: Number(data?.counters?.total ?? 0),
              confirmados: Number(data?.counters?.confirmados ?? 0),
              pendientes: Number(data?.counters?.pendientes ?? 0),
            }
          : { total: 0, confirmados: 0, pendientes: 0 },
      );
    } catch (e: any) {
      setListError(String(e?.message ?? e));
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (idpn: number) => {
    setLoadingDetail(true);
    setDetailError("");
    try {
      const res = await fetch(`/api/carnets/${idpn}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo cargar el detalle"));
      setPadron(data?.padron ?? null);
      setRegistros(Array.isArray(data?.registros) ? data.registros : []);
    } catch (e: any) {
      setDetailError(String(e?.message ?? e));
      setPadron(null);
      setRegistros([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshAll = async () => {
    const id = selectedIdpn;
    await Promise.all([
      loadList({ q: qStable.current, status, page }),
      id ? loadDetail(id) : Promise.resolve(),
    ]);
  };

  const resetViewer = () => {
    setImgScale(1);
    setImgRotate(0);
    setImgX(0);
    setImgY(0);
    dragging.current = false;
    dragLast.current = null;
  };

  const zoomTo = (next: number) => {
    const v = Math.max(1, Math.min(4, Number(next)));
    setImgScale(v);
    if (v === 1) {
      setImgX(0);
      setImgY(0);
    }
  };

  useEffect(() => {
    if (qDebounce.current) clearTimeout(qDebounce.current);
    qDebounce.current = setTimeout(() => {
      qStable.current = q;
      setPage(1);
      loadList({ q, status, page: 1 });
    }, 250);
    return () => {
      if (qDebounce.current) clearTimeout(qDebounce.current);
    };
  }, [q, status]);

  useEffect(() => {
    loadList({ q: qStable.current, status, page });
  }, [page]);

  useEffect(() => {
    if (!selectedIdpn) return;
    loadDetail(selectedIdpn);
  }, [selectedIdpn]);

  useEffect(() => {
    resetViewer();
  }, [selectedIdpn, padron?.img_carnet]);

  const onPick = (r: CarnetListadoRow) => {
    setSelectedIdpn(r.idpn);
    setEditingId(null);
    setEditingFecha("");
    setEditingEdad("");
    setEditingResultado("");
  };

  const setEstado = async (next: "pendiente" | "confirmado") => {
    if (!padron) return;
    setSavingEstado(true);
    setDetailError("");
    try {
      const res = await fetch(`/api/carnets/${padron.idpn}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_verificacion: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo actualizar el estado"));
      await refreshAll();
    } catch (e: any) {
      setDetailError(String(e?.message ?? e));
    } finally {
      setSavingEstado(false);
    }
  };

  const startEdit = (r: RegistroHemoglobinaRow) => {
    setEditingId(r.id);
    setEditingFecha(r.fecha_examen ?? "");
    setEditingEdad(r.edad ?? "");
    setEditingResultado(r.resultado ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingFecha("");
    setEditingEdad("");
    setEditingResultado("");
  };

  const saveEditRow = async (r: RegistroHemoglobinaRow) => {
    setSavingEdit(true);
    setDetailError("");
    try {
      const res = await fetch(`/api/registros-hemoglobina/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_examen: editingFecha || null,
          edad: editingEdad || null,
          resultado: editingResultado || null,
          tipo: r.tipo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo actualizar"));
      cancelEdit();
      await refreshAll();
    } catch (e: any) {
      setDetailError(String(e?.message ?? e));
    } finally {
      setSavingEdit(false);
    }
  };

  const addRegistro = async (tipo: 1 | 2) => {
    if (!padron?.dni) {
      setDetailError("Este padrón no tiene DNI.");
      return;
    }
    setDetailError("");
    try {
      if (tipo === 1) setAddingTipo1(true);
      else setAddingTipo2(true);

      const fecha_examen = tipo === 1 ? newFecha1 : newFecha2;
      const edad = tipo === 1 ? newEdad1 : newEdad2;
      const resultado = tipo === 1 ? newResultado1 : newResultado2;

      const res = await fetch(`/api/registros-hemoglobina`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dni: padron.dni,
          fecha_examen: fecha_examen || null,
          edad: edad || null,
          resultado: resultado || null,
          tipo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo registrar"));

      if (tipo === 1) {
        setNewFecha1("");
        setNewEdad1("");
        setNewResultado1("");
      } else {
        setNewFecha2("");
        setNewEdad2("");
        setNewResultado2("");
      }

      await refreshAll();
    } catch (e: any) {
      setDetailError(String(e?.message ?? e));
    } finally {
      if (tipo === 1) setAddingTipo1(false);
      else setAddingTipo2(false);
    }
  };

  const delRegistro = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeletingId(id);
    setDetailError("");
    try {
      const res = await fetch(`/api/registros-hemoglobina/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo eliminar"));
      await refreshAll();
    } catch (e: any) {
      setDetailError(String(e?.message ?? e));
    } finally {
      setDeletingId(null);
    }
  };

  const regTipo1 = useMemo(() => registros.filter((r) => Number(r.tipo) !== 2), [registros]);
  const regTipo2 = useMemo(() => registros.filter((r) => Number(r.tipo) === 2), [registros]);

  const selectedBadge = estadoBadge(padron?.estado_verificacion);
  const selectedDni = padron?.dni ? onlyDigits(padron.dni) : "";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Carnets registrados</div>
                <div className="mt-1 text-xs text-zinc-500">Filtra por DNI y registra Hb/Suplementación</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ring-inset bg-zinc-50 text-zinc-700 ring-zinc-200">
                  Total: {counters.total}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                  Verificados: {counters.confirmados}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-200">
                  Pendientes: {counters.pendientes}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-700">Buscar por DNI</span>
                <input
                  value={q}
                  onChange={(e) => setQ(onlyDigits(e.target.value))}
                  placeholder="Ej: 98765432"
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-700">Estado</span>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus((e.target.value as any) || "pendiente");
                    setPage(1);
                  }}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="pendiente">Pendientes</option>
                  <option value="confirmado">Confirmados</option>
                  <option value="all">Todos</option>
                </select>
              </label>
            </div>

            {listError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{listError}</div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-zinc-200">
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">DNI</th>
                      <th className="px-3 py-2 text-left font-medium">Nombres</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {loadingList ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-zinc-500">
                          Cargando...
                        </td>
                      </tr>
                    ) : rows.length ? (
                      rows.map((r) => {
                        const b = estadoBadge(r.estado_verificacion);
                        const active = selectedIdpn === r.idpn;
                        return (
                          <tr
                            key={r.idpn}
                            className={active ? "bg-zinc-50" : "hover:bg-zinc-50"}
                            onClick={() => onPick(r)}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="px-3 py-2 font-medium text-zinc-900">{r.dni || "—"}</td>
                            <td className="px-3 py-2 text-zinc-700">{r.nombres || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${b.cls}`}>
                                {b.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-zinc-500">
                          Sin resultados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">
                {from}-{to} de {counters.total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loadingList}
                >
                  Anterior
                </button>
                <div className="text-xs text-zinc-500">
                  {page} / {totalPages}
                </div>
                <button
                  type="button"
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loadingList}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          {!selectedIdpn ? (
            <div className="text-sm text-zinc-600">Selecciona un carnet de la lista para ver su imagen y registrar Hb/Suplementación.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {detailError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{detailError}</div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Detalle del carnet</div>
                  <div className="mt-1 text-xs text-zinc-500">DNI: {selectedDni || "—"} · IDPN: {selectedIdpn}</div>
                  <div className="mt-1 text-xs text-zinc-500">{padron?.nombres || "—"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${selectedBadge.cls}`}>
                    {selectedBadge.label}
                  </span>
                  <button
                    type="button"
                    className="h-9 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                    onClick={() => setEstado("confirmado")}
                    disabled={!padron || savingEstado}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
                    onClick={() => setEstado("pendiente")}
                    disabled={!padron || savingEstado}
                  >
                    Marcar pendiente
                  </button>
                </div>
              </div>

              {loadingDetail ? (
                <div className="text-sm text-zinc-500">Cargando detalle...</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    {padron?.img_carnet ? (
                      <div className="rounded-xl bg-white ring-1 ring-black/5 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
                          <div className="text-xs font-medium text-zinc-700">Imagen</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-900"
                              onClick={() => zoomTo(imgScale - 0.25)}
                            >
                              Zoom -
                            </button>
                            <button
                              type="button"
                              className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-900"
                              onClick={() => zoomTo(imgScale + 0.25)}
                            >
                              Zoom +
                            </button>
                            <button
                              type="button"
                              className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-900"
                              onClick={() => setImgRotate((r) => (r + 270) % 360)}
                            >
                              Girar ⟲
                            </button>
                            <button
                              type="button"
                              className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-900"
                              onClick={() => setImgRotate((r) => (r + 90) % 360)}
                            >
                              Girar ⟳
                            </button>
                            <button
                              type="button"
                              className="h-8 rounded-lg bg-zinc-900 px-2 text-xs font-medium text-white"
                              onClick={resetViewer}
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div
                          className="relative h-[520px] bg-white"
                          onWheel={(e) => {
                            e.preventDefault();
                            const dir = e.deltaY < 0 ? 1 : -1;
                            zoomTo(imgScale + dir * 0.15);
                          }}
                          onPointerDown={(e) => {
                            if (imgScale <= 1) return;
                            (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                            dragging.current = true;
                            dragLast.current = { x: e.clientX, y: e.clientY };
                          }}
                          onPointerMove={(e) => {
                            if (!dragging.current || imgScale <= 1) return;
                            const prev = dragLast.current;
                            if (!prev) return;
                            const dx = e.clientX - prev.x;
                            const dy = e.clientY - prev.y;
                            dragLast.current = { x: e.clientX, y: e.clientY };
                            setImgX((v) => v + dx);
                            setImgY((v) => v + dy);
                          }}
                          onPointerUp={() => {
                            dragging.current = false;
                            dragLast.current = null;
                          }}
                          onPointerCancel={() => {
                            dragging.current = false;
                            dragLast.current = null;
                          }}
                          onDoubleClick={resetViewer}
                          style={{ touchAction: imgScale > 1 ? "none" : "pan-y" }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <img
                              src={`/api/carnets/${selectedIdpn}/image`}
                              alt="Carnet"
                              draggable={false}
                              className="max-h-full max-w-full select-none"
                              style={{
                                transform: `translate(${imgX}px, ${imgY}px) scale(${imgScale}) rotate(${imgRotate}deg)`,
                                transformOrigin: "center center",
                                cursor: imgScale > 1 ? (dragging.current ? "grabbing" : "grab") : "default",
                              }}
                            />
                          </div>
                        </div>
                        <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
                          Zoom: {Math.round(imgScale * 100)}% · Rotación: {imgRotate}°
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-80 items-center justify-center rounded-xl bg-white text-sm text-zinc-500">
                        Sin imagen
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                        <div className="font-medium text-zinc-900">Etapa</div>
                        <div className="mt-0.5">{padron?.etapa || "—"}</div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                        <div className="font-medium text-zinc-900">Fecha Nac.</div>
                        <div className="mt-0.5">{fmtDate(padron?.fecha_nac)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-zinc-900">Hemoglobina (Tipo 1)</div>
                        <div className="text-xs text-zinc-500">Registros: {regTipo1.length}</div>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-xs text-zinc-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Fecha</th>
                              <th className="px-3 py-2 text-left font-medium">Edad</th>
                              <th className="px-3 py-2 text-left font-medium">Resultado</th>
                              <th className="px-3 py-2 text-left font-medium">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 bg-white">
                            {regTipo1.length ? (
                              regTipo1.map((r) => {
                                const editing = editingId === r.id;
                                return (
                                  <tr key={r.id}>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <input
                                          type="date"
                                          value={editingFecha}
                                          onChange={(e) => setEditingFecha(e.target.value)}
                                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                                        />
                                      ) : (
                                        <span className="text-zinc-700">{fmtDate(r.fecha_examen)}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <input
                                          value={editingEdad}
                                          onChange={(e) => setEditingEdad(e.target.value)}
                                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                                        />
                                      ) : (
                                        <span className="text-zinc-700">{r.edad || "—"}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <input
                                          value={editingResultado}
                                          onChange={(e) => setEditingResultado(e.target.value)}
                                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                                        />
                                      ) : (
                                        <span className="text-zinc-700">{r.resultado || "—"}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50"
                                            onClick={() => saveEditRow(r)}
                                            disabled={savingEdit}
                                          >
                                            Guardar
                                          </button>
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                                            onClick={cancelEdit}
                                            disabled={savingEdit}
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                                            onClick={() => startEdit(r)}
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl border border-red-200 bg-red-50 px-3 text-sm text-red-700 disabled:opacity-50"
                                            onClick={() => delRegistro(r.id)}
                                            disabled={deletingId === r.id}
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                                  Sin registros
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <input
                          type="date"
                          value={newFecha1}
                          onChange={(e) => setNewFecha1(e.target.value)}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        />
                        <input
                          value={newEdad1}
                          onChange={(e) => setNewEdad1(e.target.value)}
                          placeholder="Edad (ej: 6m)"
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        />
                        <input
                          value={newResultado1}
                          onChange={(e) => setNewResultado1(e.target.value)}
                          placeholder="Resultado"
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        />
                        <button
                          type="button"
                          className="h-10 rounded-xl bg-fuchsia-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => addRegistro(1)}
                          disabled={addingTipo1}
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-zinc-900">Suplementación (Tipo 2)</div>
                        <div className="text-xs text-zinc-500">Registros: {regTipo2.length}</div>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-xs text-zinc-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Fecha</th>
                              <th className="px-3 py-2 text-left font-medium">Edad</th>
                              <th className="px-3 py-2 text-left font-medium">Resultado</th>
                              <th className="px-3 py-2 text-left font-medium">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 bg-white">
                            {regTipo2.length ? (
                              regTipo2.map((r) => {
                                const editing = editingId === r.id;
                                return (
                                  <tr key={r.id}>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <input
                                          type="date"
                                          value={editingFecha}
                                          onChange={(e) => setEditingFecha(e.target.value)}
                                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                                        />
                                      ) : (
                                        <span className="text-zinc-700">{fmtDate(r.fecha_examen)}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <input
                                          value={editingEdad}
                                          onChange={(e) => setEditingEdad(e.target.value)}
                                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                                        />
                                      ) : (
                                        <span className="text-zinc-700">{r.edad || "—"}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <input
                                          value={editingResultado}
                                          onChange={(e) => setEditingResultado(e.target.value)}
                                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                                        />
                                      ) : (
                                        <span className="text-zinc-700">{r.resultado || "—"}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {editing ? (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50"
                                            onClick={() => saveEditRow(r)}
                                            disabled={savingEdit}
                                          >
                                            Guardar
                                          </button>
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                                            onClick={cancelEdit}
                                            disabled={savingEdit}
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                                            onClick={() => startEdit(r)}
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="h-9 rounded-xl border border-red-200 bg-red-50 px-3 text-sm text-red-700 disabled:opacity-50"
                                            onClick={() => delRegistro(r.id)}
                                            disabled={deletingId === r.id}
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                                  Sin registros
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <input
                          type="date"
                          value={newFecha2}
                          onChange={(e) => setNewFecha2(e.target.value)}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        />
                        <input
                          value={newEdad2}
                          onChange={(e) => setNewEdad2(e.target.value)}
                          placeholder="Edad (ej: 6m)"
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        />
                        <input
                          value={newResultado2}
                          onChange={(e) => setNewResultado2(e.target.value)}
                          placeholder="Resultado"
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        />
                        <button
                          type="button"
                          className="h-10 rounded-xl bg-fuchsia-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => addRegistro(2)}
                          disabled={addingTipo2}
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
