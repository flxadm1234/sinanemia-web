import { NextResponse } from "next/server";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { ensureInformeConfiguracionTable, getInformeConfiguracionById } from "@/lib/informeConfiguracion";
import fs from "fs/promises";
import path from "path";

function contentTypeByExt(extRaw: string) {
  const ext = String(extRaw || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
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
  if (!row || !row.logo_path) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  try {
    const buf = await fs.readFile(String(row.logo_path));
    const ext = path.extname(String(row.logo_path));
    return new NextResponse(buf, { headers: { "Content-Type": contentTypeByExt(ext), "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
}

