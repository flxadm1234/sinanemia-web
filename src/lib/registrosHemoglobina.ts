import { getDbPool } from "@/lib/db";

export type RegistroHemoglobinaRow = {
  id: number;
  dni_extraido: string | null;
  dni_consultado: string | null;
  fecha_examen: string | null;
  edad: string | null;
  resultado: string | null;
  tipo: number | null;
};

export async function listRegistrosHemoglobinaByDni(dni: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT id, dni_extraido, dni_consultado, fecha_examen, edad, resultado, tipo
     FROM registros_hemoglobina
     WHERE TRIM(COALESCE(dni_consultado,'')) = TRIM(?)
     ORDER BY fecha_examen DESC, id DESC`,
    [dni],
  );
  return (rows as any[]).map(
    (r) =>
      ({
        id: Number(r.id),
        dni_extraido: r.dni_extraido == null ? null : String(r.dni_extraido),
        dni_consultado: r.dni_consultado == null ? null : String(r.dni_consultado),
        fecha_examen: r.fecha_examen == null ? null : String(r.fecha_examen).slice(0, 10),
        edad: r.edad == null ? null : String(r.edad),
        resultado: r.resultado == null ? null : String(r.resultado),
        tipo: r.tipo == null ? null : Number(r.tipo),
      }) satisfies RegistroHemoglobinaRow,
  );
}

export async function createRegistroHemoglobina(params: {
  dni: string;
  fecha_examen?: string | null;
  edad?: string | null;
  resultado?: string | null;
  tipo: number;
}) {
  const pool = getDbPool();
  const tipo = params.tipo === 2 ? 2 : 1;
  const [res] = await pool.query(
    `INSERT INTO registros_hemoglobina
      (dni_extraido, dni_consultado, fecha_examen, edad, resultado, tipo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.dni, params.dni, params.fecha_examen ?? null, params.edad ?? null, params.resultado ?? null, tipo],
  );
  return res as any;
}

export async function updateRegistroHemoglobina(params: {
  id: number;
  fecha_examen?: string | null;
  edad?: string | null;
  resultado?: string | null;
  tipo?: number | null;
}) {
  const pool = getDbPool();
  const tipo = params.tipo === 2 ? 2 : 1;
  const [res] = await pool.query(
    `UPDATE registros_hemoglobina
     SET fecha_examen = ?, edad = ?, resultado = ?, tipo = ?
     WHERE id = ?`,
    [params.fecha_examen ?? null, params.edad ?? null, params.resultado ?? null, tipo, params.id],
  );
  return res as any;
}

export async function deleteRegistroHemoglobina(id: number) {
  const pool = getDbPool();
  const [res] = await pool.query(`DELETE FROM registros_hemoglobina WHERE id = ?`, [id]);
  return res as any;
}

export async function getRegistroHemoglobinaById(id: number) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT id, dni_extraido, dni_consultado, fecha_examen, edad, resultado, tipo
     FROM registros_hemoglobina
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  const r = (rows as any[])?.[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    dni_extraido: r.dni_extraido == null ? null : String(r.dni_extraido),
    dni_consultado: r.dni_consultado == null ? null : String(r.dni_consultado),
    fecha_examen: r.fecha_examen == null ? null : String(r.fecha_examen).slice(0, 10),
    edad: r.edad == null ? null : String(r.edad),
    resultado: r.resultado == null ? null : String(r.resultado),
    tipo: r.tipo == null ? null : Number(r.tipo),
  } satisfies RegistroHemoglobinaRow;
}

