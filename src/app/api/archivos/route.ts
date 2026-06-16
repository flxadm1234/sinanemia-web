import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createArchivoUpload,
  ensureArchivosTables,
  listArchivosUploads,
  makeStoredFileName,
  saveArchivoToDisk,
} from "@/lib/archivos";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "SUPER ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensureArchivosTables();
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 30);
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 && pageSizeRaw <= 200 ? Math.floor(pageSizeRaw) : 30;
  const offset = (page - 1) * pageSize;

  const data = await listArchivosUploads({ q, limit: pageSize, offset });
  return NextResponse.json({ ok: true, ...data, page, pageSize });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (session.tipo !== "SUPER ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    await ensureArchivosTables();
    const formData = await req.formData();
    const f = formData.get("file");
    const titleRaw = String(formData.get("title") ?? "").trim();
    const title = titleRaw ? titleRaw : null;
    if (!(f instanceof File)) return NextResponse.json({ error: "Debes adjuntar un archivo." }, { status: 400 });

    const { storedName, ext } = makeStoredFileName(f.name || "archivo");
    const saved = await saveArchivoToDisk({ file: f, storedName });

    const row = await createArchivoUpload({
      originalName: String(f.name || storedName),
      storedName,
      ext,
      mimeType: String((f as any)?.type ?? "") || null,
      sizeBytes: saved.sizeBytes,
      title,
      uploadedBy: session.dni,
    });
    if (!row) return NextResponse.json({ error: "No se pudo registrar el archivo." }, { status: 500 });
    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e ?? "upload_failed") }, { status: 500 });
  }
}

