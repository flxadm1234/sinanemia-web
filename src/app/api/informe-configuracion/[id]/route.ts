import { NextResponse } from "next/server";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import {
  deleteInformeConfiguracion,
  ensureInformeConfiguracionTable,
  getInformeConfiguracionById,
  updateInformeConfiguracion,
} from "@/lib/informeConfiguracion";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

function getInformeLogoDir() {
  return String(process.env.INFORME_LOGO_DIR ?? "/var/www/sinanemia/logo").trim() || "/var/www/sinanemia/logo";
}

function normalizeUbigeo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

function safeExt(fileName: string, mime: string) {
  const ext = path.extname(String(fileName || "")).toLowerCase().replace(".", "");
  if (ext) return ext;
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "";
}

async function saveLogo(file: File) {
  const dir = getInformeLogoDir();
  await fs.mkdir(dir, { recursive: true });

  const mime = String(file.type || "").toLowerCase();
  const ext = safeExt(file.name, mime);
  const allowed = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
  const key = ext === "jpeg" ? "jpg" : ext;
  if (!allowed.has(key)) throw new Error("invalid_logo_type");

  const buf = Buffer.from(await file.arrayBuffer());
  const id = typeof (crypto as any).randomUUID === "function" ? (crypto as any).randomUUID() : crypto.randomBytes(16).toString("hex");
  const storedName = `${id}.${key}`;
  const fullPath = path.join(dir, storedName);
  await fs.writeFile(fullPath, buf);
  return fullPath;
}

async function safeUnlink(p: string | null) {
  if (!p) return;
  try {
    const dir = path.resolve(getInformeLogoDir());
    const full = path.resolve(String(p));
    if (!full.startsWith(dir)) return;
    await fs.unlink(full);
  } catch {}
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeConfiguracionTable();
  const { id } = await ctx.params;
  const row = await getInformeConfiguracionById({
    id: Number(id),
    role: s.tipo,
    sessionUbigeo: s.ubigeo,
  });
  if (!row) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeConfiguracionTable();
  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) return NextResponse.json({ error: "Id inválido." }, { status: 400 });

  try {
    const existing = await getInformeConfiguracionById({
      id: rowId,
      role: s.tipo,
      sessionUbigeo: s.ubigeo,
    });
    if (!existing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

    const form = await req.formData();
    const ubigeo = s.tipo === "SUPER ADMIN" ? normalizeUbigeo(form.get("ubigeo")) : undefined;
    const entidad_nombre = String(form.get("entidad_nombre") ?? "").trim() || null;
    const gerencia_nombre = String(form.get("gerencia_nombre") ?? "").trim() || null;
    const lema_anual = String(form.get("lema_anual") ?? "").trim() || null;
    const pie_cargo = String(form.get("pie_cargo") ?? "").trim() || null;
    const ciudad = String(form.get("ciudad") ?? "").trim() || null;
    const activo = String(form.get("activo") ?? "1").trim() === "1" ? 1 : 0;

    let logo_path: string | undefined = undefined;
    const logo = form.get("logo");
    if (logo && typeof logo !== "string" && logo instanceof File && logo.size > 0) {
      const saved = await saveLogo(logo);
      logo_path = saved;
      await safeUnlink(existing.logo_path);
    }

    const updated = await updateInformeConfiguracion({
      id: rowId,
      role: s.tipo,
      sessionUbigeo: s.ubigeo,
      ubigeo: ubigeo || undefined,
      entidad_nombre,
      gerencia_nombre,
      lema_anual,
      pie_cargo,
      ciudad,
      activo,
      ...(typeof logo_path === "string" ? { logo_path } : {}),
    });

    if (!updated) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json({ row: updated });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "invalid_logo_type") {
      return NextResponse.json({ error: "Logo inválido. Solo se permite PNG/JPG/WEBP/GIF." }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 400 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeConfiguracionTable();
  const { id } = await ctx.params;
  const deleted = await deleteInformeConfiguracion({
    id: Number(id),
    role: s.tipo,
    sessionUbigeo: s.ubigeo,
  });
  if (!deleted) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  await safeUnlink(deleted.logo_path);
  return NextResponse.json({ ok: true });
}

