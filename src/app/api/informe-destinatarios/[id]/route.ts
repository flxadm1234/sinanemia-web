import { NextResponse } from "next/server";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import {
  deleteInformeDestinatario,
  ensureInformeDestinatariosTable,
  getInformeDestinatarioById,
  updateInformeDestinatario,
} from "@/lib/informeDestinatarios";

function normalizeUbigeo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeDestinatariosTable();
  const { id } = await ctx.params;
  const row = await getInformeDestinatarioById({
    id: Number(id),
    role: s.tipo,
    sessionUbigeo: s.ubigeo,
  });
  if (!row) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeDestinatariosTable();
  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) return NextResponse.json({ error: "Id inválido." }, { status: 400 });

  try {
    const existing = await getInformeDestinatarioById({
      id: rowId,
      role: s.tipo,
      sessionUbigeo: s.ubigeo,
    });
    if (!existing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

    const form = await req.formData();
    const ubigeo = s.tipo === "SUPER ADMIN" ? normalizeUbigeo(form.get("ubigeo")) : undefined;
    const nombre = String(form.get("nombre") ?? "").trim();
    const cargo = String(form.get("cargo") ?? "").trim() || null;
    const activo = String(form.get("activo") ?? "1").trim() === "1" ? 1 : 0;
    const ordenRaw = String(form.get("orden") ?? "").trim();
    const orden = ordenRaw && Number.isFinite(Number(ordenRaw)) ? Math.max(1, Math.floor(Number(ordenRaw))) : 1;

    const updated = await updateInformeDestinatario({
      id: rowId,
      role: s.tipo,
      sessionUbigeo: s.ubigeo,
      ubigeo: ubigeo || undefined,
      nombre,
      cargo,
      activo,
      orden,
    });
    if (!updated) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json({ row: updated });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "invalid_nombre") {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeDestinatariosTable();
  const { id } = await ctx.params;
  const deleted = await deleteInformeDestinatario({
    id: Number(id),
    role: s.tipo,
    sessionUbigeo: s.ubigeo,
  });
  if (!deleted) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

