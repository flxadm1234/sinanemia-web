import { NextResponse } from "next/server";
import path from "path";
import { readdir, readFile } from "fs/promises";
import { getSession } from "@/lib/auth";
import { getCarnetByIdpn } from "@/lib/carnets";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";

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

async function tryRead(root: string, filename: string) {
  const safeName = path.basename(filename);
  const filePath = path.join(root, safeName);
  const buf = await readFile(filePath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { safeName, buf: ab };
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

  const sel = await getEtapaSeleccionadaPorUbigeo(session.ubigeo);
  if (!sel?.etapa) return NextResponse.json({ error: "missing_etapa" }, { status: 400 });

  const padron = await getCarnetByIdpn({ ubigeo: session.ubigeo, idpn, etapa: sel.etapa });
  if (!padron) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const imgRaw = String(padron.img_carnet ?? "").trim();
  if (!imgRaw) return NextResponse.json({ error: "no_image" }, { status: 404 });

  const root = process.env.SINANEMIA_CARNETS_DIR || "/var/www/sinanemia/actorSocial/carnets";
  const safeName = path.basename(imgRaw);
  const ext = path.extname(safeName);

  const candidates = new Set<string>();
  candidates.add(safeName);
  if (safeName.startsWith("img_carnet_")) candidates.add(safeName.replace(/^img_carnet_/, "carnet_"));
  if (ext && ext !== ".webp") candidates.add(safeName.slice(0, -ext.length) + ".webp");
  if (safeName.startsWith("img_carnet_") && ext && ext !== ".webp")
    candidates.add(safeName.replace(/^img_carnet_/, "carnet_").slice(0, -ext.length) + ".webp");

  try {
    let found: { safeName: string; buf: ArrayBuffer } | null = null;
    for (const c of candidates) {
      try {
        found = await tryRead(root, c);
        break;
      } catch (e: any) {
        if (String(e?.code ?? "") !== "ENOENT") throw e;
      }
    }

    if (!found) {
      const files = await readdir(root).catch(() => []);
      const pref1 = `carnet_${idpn}_`;
      const pref2 = `img_carnet_${idpn}_`;
      const match = files
        .filter((f) => typeof f === "string" && (f.startsWith(pref1) || f.startsWith(pref2)))
        .sort()
        .at(-1);
      if (!match) return NextResponse.json({ error: "file_not_found" }, { status: 404 });
      found = await tryRead(root, match);
    }

    return new NextResponse(found.buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(found.safeName),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const code = String(e?.code ?? "");
    if (code === "ENOENT") return NextResponse.json({ error: "file_not_found" }, { status: 404 });
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}
