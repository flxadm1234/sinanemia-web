import { getDbPool } from "@/lib/db";
import { z } from "zod";

export const PersonaTipo = z.enum([
  "SUPER ADMIN",
  "ADMINISTRADOR",
  "COORDINADOR",
  "ACTOR SOCIAL",
  "INVITADO",
  "SUPERVISOR",
]);

export type PersonaRole = z.infer<typeof PersonaTipo>;

export type PersonaSafe = {
  idpersona: number;
  dni: string;
  nombrecompleto: string | null;
  apellidos: string;
  tipo: string | null;
  estado: number | null;
  ubigeo: number | null;
  cdr: string;
  telefono?: string | null;
  sectorizacion?: number | null;
};

function normalizeTipo(tipo: string | null | undefined) {
  const t = (tipo ?? "").trim().toUpperCase();
  if (t === "SUPER ADMIN" || t === "SUPERADMIN") return "SUPER ADMIN";
  if (t === "ADMINISTRADOR") return "ADMINISTRADOR";
  if (t === "COORDINADOR") return "COORDINADOR";
  if (t.startsWith("ACTOR SOCIAL")) return "ACTOR SOCIAL";
  if (t === "INVITADO") return "INVITADO";
  if (
    t === "SUPERVISOR" ||
    t === "INVITADO VIP" ||
    t === "INVITADOVIP" ||
    t === "INVITADO_VIP"
  )
    return "SUPERVISOR";
  return null;
}

export async function findPersonaById(idpersona: number) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono, direccion, email, clave FROM persona WHERE idpersona = ? LIMIT 1",
    [idpersona],
  );
  const row = (rows as any[])[0] as
    | (PersonaSafe & {
        direccion?: string | null;
        email?: string | null;
        clave: string | null;
      })
    | undefined;
  if (!row) return null;
  return row;
}

export async function findPersonaForLogin(dni: string, clave: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, clave, telefono FROM persona WHERE dni = ? AND clave = ? LIMIT 1",
    [dni, clave],
  );
  const row = (rows as any[])[0] as
    | (PersonaSafe & { clave: string | null })
    | undefined;
  if (!row) return null;
  return row;
}

export async function findPersonaByDni(dni: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono FROM persona WHERE dni = ? ORDER BY idpersona DESC LIMIT 1",
    [dni],
  );
  return ((rows as any[])[0] as PersonaSafe | undefined) ?? null;
}

export async function listPersonas(params: {
  ubigeo?: number;
  estado?: number;
  tipo?: string;
  q?: string;
}) {
  const pool = getDbPool();
  const where: string[] = [];
  const values: any[] = [];

  if (typeof params.ubigeo === "number") {
    where.push("ubigeo = ?");
    values.push(params.ubigeo);
  }

  if (typeof params.estado === "number") {
    where.push("estado = ?");
    values.push(params.estado);
  }

  if (params.tipo && params.tipo.trim()) {
    const tipo = params.tipo.trim().toUpperCase();
    if (tipo === "ACTOR SOCIAL") where.push("UPPER(tipo) LIKE 'ACTOR SOCIAL%'");
    else {
      where.push("UPPER(tipo) = ?");
      values.push(tipo);
    }
  }

  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`;
    where.push(
      "(dni LIKE ? OR nombrecompleto LIKE ? OR apellidos LIKE ? OR cdr LIKE ? OR telefono LIKE ?)",
    );
    values.push(like, like, like, like, like);
  }

  const sql =
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono, " +
    "(SELECT 1 FROM sectorizacion_actor sa WHERE sa.dni_actor_social = persona.dni LIMIT 1) AS sectorizacion " +
    "FROM persona" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY idpersona DESC";

  const [rows] = await pool.query(sql, values);
  return rows as PersonaSafe[];
}

export async function listActoresPorCoordinador(dniCoordinador: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono, " +
      "(SELECT 1 FROM sectorizacion_actor sa WHERE sa.dni_actor_social = persona.dni LIMIT 1) AS sectorizacion " +
      "FROM persona WHERE UPPER(tipo) LIKE 'ACTOR SOCIAL%' AND cdr = ? ORDER BY idpersona DESC",
    [dniCoordinador],
  );
  return rows as PersonaSafe[];
}

export async function listActoresSociales(params: {
  ubigeo?: number;
  cdr?: string;
  includeInactivos?: boolean;
}) {
  const pool = getDbPool();
  const where: string[] = ["UPPER(tipo) LIKE 'ACTOR SOCIAL%'"];
  const values: any[] = [];
  if (typeof params.ubigeo === "number") {
    where.push("ubigeo = ?");
    values.push(params.ubigeo);
  }
  if (params.cdr && params.cdr.trim()) {
    where.push("cdr = ?");
    values.push(params.cdr.trim());
  }
  if (!params.includeInactivos) where.push("estado = 1");

  const [rows] = await pool.query(
    `SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono FROM persona WHERE ${where.join(" AND ")} ORDER BY apellidos ASC, nombrecompleto ASC`,
    values,
  );
  return rows as PersonaSafe[];
}

export async function findActorSocialByDni(dni: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono, email, direccion FROM persona WHERE UPPER(tipo) LIKE 'ACTOR SOCIAL%' AND dni = ? ORDER BY idpersona DESC LIMIT 1",
    [dni],
  );
  return ((rows as any[])[0] as any) ?? null;
}

export async function findCoordinadorByDni(dni: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono, email, direccion FROM persona WHERE UPPER(tipo) = 'COORDINADOR' AND dni = ? ORDER BY idpersona DESC LIMIT 1",
    [dni],
  );
  return ((rows as any[])[0] as any) ?? null;
}

export async function listCoordinadores(params: {
  ubigeo?: number;
  includeInactivos?: boolean;
}) {
  const pool = getDbPool();
  const where: string[] = ["UPPER(tipo) = 'COORDINADOR'"];
  const values: any[] = [];
  if (typeof params.ubigeo === "number") {
    where.push("ubigeo = ?");
    values.push(params.ubigeo);
  }
  if (!params.includeInactivos) where.push("estado = 1");

  const [rows] = await pool.query(
    `SELECT idpersona, dni, nombrecompleto, apellidos, tipo, estado, ubigeo, cdr, telefono FROM persona WHERE ${where.join(" AND ")} ORDER BY apellidos ASC, nombrecompleto ASC`,
    values,
  );
  return rows as PersonaSafe[];
}

export async function updatePersonaEstado(idpersona: number, estado: number) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "UPDATE persona SET estado = ? WHERE idpersona = ?",
    [estado, idpersona],
  );
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

export async function updatePersonaById(idpersona: number, input: Partial<{
  nombrecompleto: string | null;
  apellidos: string;
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
  values.push(idpersona);

  const pool = getDbPool();
  const [res] = await pool.query(
    `UPDATE persona SET ${set.join(", ")} WHERE idpersona = ?`,
    values,
  );
  return res as any;
}

export function getRoleFromPersonaTipo(tipo: string | null | undefined) {
  return normalizeTipo(tipo);
}

