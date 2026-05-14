import { getDbPool } from "@/lib/db";
import { z } from "zod";

export const PersonaTipo = z.enum(["ADMINISTRADOR", "COORDINADOR", "ACTOR SOCIAL"]);

export type PersonaSafe = {
  idpersona: number;
  dni: string;
  nombrecompleto: string | null;
  apellidos: string;
  tipo: string | null;
  estado: number | null;
  ubigeo: number | null;
  cdr: string;
};

function normalizeTipo(tipo: string | null | undefined) {
  const t = (tipo ?? "").trim().toUpperCase();
  if (t === "ADMINISTRADOR") return "ADMINISTRADOR";
  if (t === "COORDINADOR") return "COORDINADOR";
  if (t.startsWith("ACTOR SOCIAL")) return "ACTOR SOCIAL";
  return null;
}

export async function findPersonaByDni(dni: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, clave FROM persona WHERE dni = ? LIMIT 1",
    [dni],
  );
  const row = (rows as any[])[0] as
    | (PersonaSafe & { clave: string | null })
    | undefined;
  if (!row) return null;
  return row;
}

export async function listActoresSociales(params: {
  estado?: number;
  q?: string;
}) {
  const pool = getDbPool();
  const where: string[] = [];
  const values: any[] = [];

  where.push("UPPER(tipo) LIKE 'ACTOR SOCIAL%'");

  if (typeof params.estado === "number") {
    where.push("estado = ?");
    values.push(params.estado);
  }

  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`;
    where.push(
      "(dni LIKE ? OR nombrecompleto LIKE ? OR apellidos LIKE ? OR cdr LIKE ?)",
    );
    values.push(like, like, like, like);
  }

  const sql =
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr FROM persona" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY apellidos ASC, nombrecompleto ASC";

  const [rows] = await pool.query(sql, values);
  return rows as PersonaSafe[];
}

export async function listActoresPorCoordinador(dniCoordinador: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr FROM persona WHERE UPPER(tipo) LIKE 'ACTOR SOCIAL%' AND cdr = ? ORDER BY apellidos ASC, nombrecompleto ASC",
    [dniCoordinador],
  );
  return rows as PersonaSafe[];
}

export async function updatePersonaEstado(dni: string, estado: number) {
  const pool = getDbPool();
  const [res] = await pool.query("UPDATE persona SET estado = ? WHERE dni = ?", [
    estado,
    dni,
  ]);
  return res as any;
}

export async function createPersona(input: {
  dni: string;
  nombrecompleto?: string | null;
  apellidos: string;
  tipo: string;
  clave: string;
  ubigeo?: number | null;
  cdr?: string;
  telefono?: string;
  direccion?: string;
  email?: string | null;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "INSERT INTO persona (dni, nombrecompleto, apellidos, cdr, telefono, direccion, tipo, clave, ubigeo, email, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
    [
      input.dni,
      input.nombrecompleto ?? null,
      input.apellidos,
      input.cdr ?? "0",
      input.telefono ?? "",
      input.direccion ?? "",
      input.tipo,
      input.clave,
      input.ubigeo ?? null,
      input.email ?? null,
    ],
  );
  return res as any;
}

export async function updatePersona(dni: string, input: Partial<{
  nombrecompleto: string | null;
  apellidos: string;
  tipo: string;
  clave: string;
  ubigeo: number | null;
  cdr: string;
  telefono: string;
  direccion: string;
  email: string | null;
}>) {
  const keys = Object.keys(input) as (keyof typeof input)[];
  if (!keys.length) return;

  const set: string[] = [];
  const values: any[] = [];
  for (const k of keys) {
    set.push(`${String(k)} = ?`);
    values.push((input as any)[k]);
  }
  values.push(dni);

  const pool = getDbPool();
  const [res] = await pool.query(
    `UPDATE persona SET ${set.join(", ")} WHERE dni = ?`,
    values,
  );
  return res as any;
}

export function getRoleFromPersonaTipo(tipo: string | null | undefined) {
  return normalizeTipo(tipo);
}

