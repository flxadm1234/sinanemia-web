import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

function normText(v: unknown) {
  return String(v ?? "").trim();
}

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normHeader(s: string) {
  return stripAccents(s).toLowerCase().trim().replace(/[\s_-]+/g, "");
}

function normalizeUbigeo(v: unknown) {
  const raw = normText(v);
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length >= 6 ? digits.slice(0, 6) : digits.padStart(6, "0");
}

function normalizeDni(v: unknown) {
  const raw = normText(v);
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length >= 8 ? digits.slice(0, 8) : digits.padStart(8, "0");
}

type ParsedRow = {
  rowNumber: number;
  dni: string;
  nombrecompleto: string;
  apellidos: string;
  cdr: string;
  telefono: string;
  clave: string;
  ubigeo: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "SUPER ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "invalid_xlsx" }, { status: 400 });
  }

  const sheetName = wb.SheetNames?.[0] ?? "";
  if (!sheetName) return NextResponse.json({ error: "empty_xlsx" }, { status: 400 });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return NextResponse.json({ error: "empty_xlsx" }, { status: 400 });

  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    raw: false,
  });

  const headerMap: Record<string, string> = {
    dni: "dni",
    nombrecompleto: "nombrecompleto",
    nombre: "nombrecompleto",
    nombreyapellidos: "nombrecompleto",
    nombrecompletoyapellidos: "nombrecompleto",
    apellidos: "apellidos",
    apellido: "apellidos",
    cdr: "cdr",
    telefono: "telefono",
    telefono1: "telefono",
    celular: "telefono",
    clave: "clave",
    password: "clave",
    ubigeo: "ubigeo",
  };

  const parsed: ParsedRow[] = [];
  const invalid: Array<{ rowNumber: number; reason: string }> = [];

  rowsRaw.forEach((r, idx) => {
    const rowNumber = idx + 2;
    const obj: any = {};
    for (const [k, v] of Object.entries(r)) {
      const nk = normHeader(k);
      const field = headerMap[nk];
      if (!field) continue;
      obj[field] = v;
    }

    const dni = normalizeDni(obj.dni);
    const nombrecompleto = normText(obj.nombrecompleto);
    const apellidos = normText(obj.apellidos);
    const cdr = normalizeDni(obj.cdr) || normText(obj.cdr) || "0";
    const telefono = normText(obj.telefono);
    const clave = normText(obj.clave);
    const ubigeo = normalizeUbigeo(obj.ubigeo);

    if (!dni) {
      invalid.push({ rowNumber, reason: "DNI inválido." });
      return;
    }
    if (!apellidos) {
      invalid.push({ rowNumber, reason: "Apellido(s) requerido." });
      return;
    }
    if (!clave) {
      invalid.push({ rowNumber, reason: "Clave requerida." });
      return;
    }

    if (session.tipo === "ADMINISTRADOR") {
      const u = String(session.ubigeo ?? "");
      if (!u) {
        invalid.push({ rowNumber, reason: "Tu usuario no tiene ubigeo." });
        return;
      }
      const expected = normalizeUbigeo(u);
      const rowUbi = ubigeo || expected;
      if (rowUbi !== expected) {
        invalid.push({
          rowNumber,
          reason: `Ubigeo fuera de tu alcance (esperado ${expected}).`,
        });
        return;
      }
      parsed.push({
        rowNumber,
        dni,
        nombrecompleto,
        apellidos,
        cdr,
        telefono,
        clave,
        ubigeo: expected,
      });
      return;
    }

    if (!ubigeo) {
      invalid.push({ rowNumber, reason: "Ubigeo requerido para SUPER ADMIN." });
      return;
    }

    parsed.push({
      rowNumber,
      dni,
      nombrecompleto,
      apellidos,
      cdr,
      telefono,
      clave,
      ubigeo,
    });
  });

  const tipo = "ACTOR SOCIAL";
  const fileSeen = new Set<string>();
  const unique: ParsedRow[] = [];
  const duplicatesInFile: Array<{ rowNumber: number; dni: string; ubigeo: string }> = [];
  for (const r of parsed) {
    const key = `${r.dni}|${tipo}|${r.ubigeo}`;
    if (fileSeen.has(key)) {
      duplicatesInFile.push({ rowNumber: r.rowNumber, dni: r.dni, ubigeo: r.ubigeo });
      continue;
    }
    fileSeen.add(key);
    unique.push(r);
  }

  const pool = getDbPool();
  const existing = new Set<string>();
  const dnis = Array.from(new Set(unique.map((r) => r.dni)));
  const chunkSize = 500;
  for (let i = 0; i < dnis.length; i += chunkSize) {
    const chunk = dnis.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT dni, ubigeo FROM persona WHERE UPPER(tipo) LIKE 'ACTOR SOCIAL%' AND dni IN (${placeholders})`,
      chunk,
    );
    for (const rr of rows as any[]) {
      const dni = normalizeDni(rr.dni);
      const ubi = normalizeUbigeo(rr.ubigeo);
      if (!dni || !ubi) continue;
      existing.add(`${dni}|${tipo}|${ubi}`);
    }
  }

  const skippedDuplicates: Array<{ rowNumber: number; dni: string; ubigeo: string }> = [];
  const toInsert: ParsedRow[] = [];

  for (const r of unique) {
    const key = `${r.dni}|${tipo}|${r.ubigeo}`;
    if (existing.has(key)) {
      skippedDuplicates.push({ rowNumber: r.rowNumber, dni: r.dni, ubigeo: r.ubigeo });
      continue;
    }
    toInsert.push(r);
  }

  let inserted = 0;
  const insertChunk = 200;
  for (let i = 0; i < toInsert.length; i += insertChunk) {
    const chunk = toInsert.slice(i, i + insertChunk);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
    const values: any[] = [];
    for (const r of chunk) {
      values.push(
        r.dni,
        r.nombrecompleto || null,
        r.apellidos,
        r.cdr || "0",
        r.telefono || "",
        "",
        tipo,
        r.clave,
        r.ubigeo,
        null,
        1,
      );
    }
    const [res] = await pool.query(
      `INSERT INTO persona (dni, nombrecompleto, apellidos, cdr, telefono, direccion, tipo, clave, ubigeo, email, estado) VALUES ${placeholders}`,
      values,
    );
    inserted += Number((res as any)?.affectedRows ?? 0);
  }

  return NextResponse.json({
    ok: true,
    tipo,
    inserted,
    skippedDuplicates,
    duplicatesInFile,
    invalid,
  });
}

