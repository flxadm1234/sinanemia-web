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

function toInt(v: unknown) {
  const s = normText(v);
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

type ParsedRow = {
  rowNumber: number;
  ubigeo: string;
  meses: string;
  numero_mes: number;
  year: number;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "SUPER ADMIN") {
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
    ubigeo: "ubigeo",
    mes: "meses",
    meses: "meses",
    nombremes: "meses",
    nromes: "numero_mes",
    nro: "numero_mes",
    numero: "numero_mes",
    numeromes: "numero_mes",
    year: "year",
    ano: "year",
    anio: "year",
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

    const ubigeo = normalizeUbigeo(obj.ubigeo);
    const meses = normText(obj.meses);
    const numero_mes = toInt(obj.numero_mes);
    const year = toInt(obj.year);

    if (!ubigeo) {
      invalid.push({ rowNumber, reason: "Ubigeo inválido." });
      return;
    }
    if (!meses) {
      invalid.push({ rowNumber, reason: "Mes requerido." });
      return;
    }
    if (!Number.isFinite(numero_mes) || numero_mes < 1 || numero_mes > 12) {
      invalid.push({ rowNumber, reason: "Nro de mes inválido (1-12)." });
      return;
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      invalid.push({ rowNumber, reason: "Año inválido." });
      return;
    }

    parsed.push({ rowNumber, ubigeo, meses, numero_mes, year });
  });

  const fileSeen = new Set<string>();
  const unique: ParsedRow[] = [];
  const duplicatesInFile: Array<{ rowNumber: number; ubigeo: string; numero_mes: number; year: number }> =
    [];

  for (const r of parsed) {
    const key = `${r.ubigeo}|${r.year}|${r.numero_mes}`;
    if (fileSeen.has(key)) {
      duplicatesInFile.push({
        rowNumber: r.rowNumber,
        ubigeo: r.ubigeo,
        numero_mes: r.numero_mes,
        year: r.year,
      });
      continue;
    }
    fileSeen.add(key);
    unique.push(r);
  }

  const pool = getDbPool();
  const existing = new Set<string>();
  const ubigeos = Array.from(new Set(unique.map((r) => r.ubigeo)));
  const chunkSize = 200;

  for (let i = 0; i < ubigeos.length; i += chunkSize) {
    const chunk = ubigeos.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT ubigeo, year, numero_mes FROM meses WHERE ubigeo IN (${placeholders})`,
      chunk,
    );
    for (const rr of rows as any[]) {
      const ubi = normalizeUbigeo(rr.ubigeo);
      const year = toInt(rr.year);
      const num = toInt(rr.numero_mes);
      if (!ubi || !Number.isFinite(year) || !Number.isFinite(num)) continue;
      existing.add(`${ubi}|${year}|${num}`);
    }
  }

  const skippedDuplicates: Array<{ rowNumber: number; ubigeo: string; numero_mes: number; year: number }> =
    [];
  const toInsert: ParsedRow[] = [];

  for (const r of unique) {
    const key = `${r.ubigeo}|${r.year}|${r.numero_mes}`;
    if (existing.has(key)) {
      skippedDuplicates.push({
        rowNumber: r.rowNumber,
        ubigeo: r.ubigeo,
        numero_mes: r.numero_mes,
        year: r.year,
      });
      continue;
    }
    toInsert.push(r);
  }

  let inserted = 0;
  const insertChunk = 200;
  for (let i = 0; i < toInsert.length; i += insertChunk) {
    const chunk = toInsert.slice(i, i + insertChunk);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
    const values: any[] = [];
    for (const r of chunk) {
      values.push(r.numero_mes, r.meses, r.year, 0, 0, r.ubigeo);
    }
    const [res] = await pool.query(
      `INSERT INTO meses (numero_mes, meses, year, seleccion, tramo, ubigeo) VALUES ${placeholders}`,
      values,
    );
    inserted += Number((res as any)?.affectedRows ?? 0);
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skippedDuplicates,
    duplicatesInFile,
    invalid,
  });
}

