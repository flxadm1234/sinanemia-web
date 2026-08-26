import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { getSession } from "@/lib/auth";
import { getCarnetByIdpn } from "@/lib/carnets";

export const runtime = "nodejs";

function parseIdpn(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const { id } = await ctx.params;
  const idpn = parseIdpn(id);
  if (!idpn) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const padron = await getCarnetByIdpn({ ubigeo: session.ubigeo, idpn });
  if (!padron) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const imgRaw = String(padron.img_carnet ?? "").trim();
  if (!imgRaw) return NextResponse.json({ error: "no_image" }, { status: 404 });

  const root = process.env.SINANEMIA_CARNETS_DIR || "/var/www/sinanemia/actorSocial/carnets";
  const safeName = path.basename(imgRaw);
  const filePath = path.join(root, safeName);

  try {
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(safeName),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const code = String(e?.code ?? "");
    if (code === "ENOENT") return NextResponse.json({ error: "file_not_found" }, { status: 404 });
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

