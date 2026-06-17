import { NextResponse } from "next/server";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import {
  createInformeDestinatario,
  ensureInformeDestinatariosTable,
  listInformeDestinatarios,
} from "@/lib/informeDestinatarios";
import { listMesesUbigeoOptions } from "@/lib/meses";

function normalizeUbigeo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

export async function GET(req: Request) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeDestinatariosTable();
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 30)));
  const ubigeo = url.searchParams.get("ubigeo") ?? undefined;

  const { total, rows } = await listInformeDestinatarios({
    role: s.tipo,
    sessionUbigeo: s.ubigeo,
    ubigeo: s.tipo === "SUPER ADMIN" ? ubigeo : undefined,
    q,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const ubigeos = s.tipo === "SUPER ADMIN" ? await listMesesUbigeoOptions() : undefined;
  return NextResponse.json({ total, rows, ubigeos });
}

export async function POST(req: Request) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeDestinatariosTable();

  try {
    const form = await req.formData();

    const ubigeo =
      s.tipo === "SUPER ADMIN"
        ? normalizeUbigeo(form.get("ubigeo"))
        : s.ubigeo
          ? normalizeUbigeo(s.ubigeo)
          : "";
    if (!ubigeo) return NextResponse.json({ error: "Ubigeo inválido." }, { status: 400 });

    const nombre = String(form.get("nombre") ?? "").trim();
    const cargo = String(form.get("cargo") ?? "").trim() || null;
    const activo = String(form.get("activo") ?? "1").trim() === "1" ? 1 : 0;
    const ordenRaw = String(form.get("orden") ?? "").trim();
    const orden = ordenRaw && Number.isFinite(Number(ordenRaw)) ? Math.max(1, Math.floor(Number(ordenRaw))) : 1;

    const row = await createInformeDestinatario({
      role: s.tipo,
      sessionUbigeo: s.ubigeo,
      ubigeo,
      nombre,
      cargo,
      activo,
      orden,
    });

    return NextResponse.json({ row });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "invalid_nombre") {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo guardar el destinatario." }, { status: 400 });
  }
}

