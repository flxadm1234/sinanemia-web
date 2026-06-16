import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureArchivosTables, getArchivoUploadById, getArchivosUploadDir } from "@/lib/archivos";
import fsSync from "fs";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";

function cleanFilename(s: string) {
  return s
    .replaceAll(/[^\w\-.,() ]+/g, "_")
    .trim()
    .slice(0, 180);
}

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

  const dir = getArchivosUploadDir();
  const filePath = path.join(dir, row.stored_name);
  if (!fsSync.existsSync(filePath)) return NextResponse.json({ error: "file_not_found" }, { status: 404 });

  const filename = cleanFilename(row.original_name || row.stored_name);
  const stream = fsSync.createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as any;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

