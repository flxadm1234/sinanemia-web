import { NextResponse } from "next/server";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import {
  createInformeConfiguracion,
  ensureInformeConfiguracionTable,
  listInformeConfiguracion,
} from "@/lib/informeConfiguracion";
import { listMesesUbigeoOptions } from "@/lib/meses";
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

export async function GET(req: Request) {
  const s = await requireAdminOrSuperAdmin();
  await ensureInformeConfiguracionTable();
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 30)));
  const ubigeo = url.searchParams.get("ubigeo") ?? undefined;

  const { total, rows } = await listInformeConfiguracion({
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
  await ensureInformeConfiguracionTable();

  try {
    const form = await req.formData();

    const ubigeo =
      s.tipo === "SUPER ADMIN"
        ? normalizeUbigeo(form.get("ubigeo"))
        : s.ubigeo
          ? normalizeUbigeo(s.ubigeo)
          : "";
    if (!ubigeo) return NextResponse.json({ error: "Ubigeo inválido." }, { status: 400 });

    const entidad_nombre = String(form.get("entidad_nombre") ?? "").trim() || null;
    const gerencia_nombre = String(form.get("gerencia_nombre") ?? "").trim() || null;
    const lema_anual = String(form.get("lema_anual") ?? "").trim() || null;
    const pie_cargo = String(form.get("pie_cargo") ?? "").trim() || null;
    const ciudad = String(form.get("ciudad") ?? "").trim() || null;
    const activo = String(form.get("activo") ?? "1").trim() === "1" ? 1 : 0;

    let logo_path: string | null = null;
    const logo = form.get("logo");
    if (logo && typeof logo !== "string" && logo instanceof File && logo.size > 0) {
      logo_path = await saveLogo(logo);
    }

    const row = await createInformeConfiguracion({
      role: s.tipo,
      sessionUbigeo: s.ubigeo,
      ubigeo,
      entidad_nombre,
      gerencia_nombre,
      lema_anual,
      logo_path,
      pie_cargo,
      ciudad,
      activo,
    });

    return NextResponse.json({ row });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "invalid_logo_type") {
      return NextResponse.json({ error: "Logo inválido. Solo se permite PNG/JPG/WEBP/GIF." }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 400 });
  }
}

