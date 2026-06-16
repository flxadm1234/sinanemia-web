import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  deleteArchivoUpload,
  ensureArchivosTables,
  getArchivoUploadById,
  updateArchivoUpload,
} from "@/lib/archivos";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "SUPER ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensureArchivosTables();
  const { id } = await ctx.params;
  const num = Number(String(id ?? "").trim());
  if (!Number.isFinite(num) || num <= 0) return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  const row = await getArchivoUploadById(num);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "SUPER ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensureArchivosTables();
  const { id } = await ctx.params;
  const num = Number(String(id ?? "").trim());
  if (!Number.isFinite(num) || num <= 0) return NextResponse.json({ error: "id_invalido" }, { status: 400 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const titleRaw = String(body?.title ?? "").trim();
  const title = titleRaw ? titleRaw : null;

  const row = await updateArchivoUpload({ id: num, title });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "SUPER ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensureArchivosTables();
  const { id } = await ctx.params;
  const num = Number(String(id ?? "").trim());
  if (!Number.isFinite(num) || num <= 0) return NextResponse.json({ error: "id_invalido" }, { status: 400 });

  const res = await deleteArchivoUpload({ id: num });
  if (!res.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: true });
}

