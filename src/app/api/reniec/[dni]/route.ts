import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function sanitizeDni(raw: string) {
  const v = raw.trim();
  if (!/^\d{8}$/.test(v)) return null;
  return v;
}

export async function GET(_: Request, ctx: { params: Promise<{ dni: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (
    session.tipo !== "COORDINADOR" &&
    session.tipo !== "ADMINISTRADOR" &&
    session.tipo !== "SUPER ADMIN"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { dni } = await ctx.params;
  const sanitized = sanitizeDni(dni);
  if (!sanitized) {
    return NextResponse.json({ error: "invalid_dni" }, { status: 400 });
  }

  const url = `http://31.220.84.86:5002/reniec/${sanitized}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "not_found", status: res.status },
      { status: 404 },
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "invalid_upstream" }, { status: 502 });
  }

  const payload = {
    dni: String(data?.dni ?? sanitized),
    nombres: String(data?.first_name ?? "").trim(),
    apellidoPaterno: String(data?.paternal_last_name ?? "").trim(),
    apellidoMaterno: String(data?.maternal_last_name ?? "").trim(),
    direccion: String(data?.direccion ?? "").trim(),
    fechaNac: String(data?.birth_date ?? "").trim(),
    sexo: String(data?.sexo ?? "").trim(),
  };

  return NextResponse.json(payload);
}

