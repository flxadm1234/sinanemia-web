import { getDbPool } from "@/lib/db";

export type SectorizacionActor = {
  id_sectorizacion_actor: number;
  dni_actor_social: string;
  tipo_centro_poblado: string | null;
  centro_poblado: string | null;
  zona: string | null;
  mz: string | null;
  sector: string | null;
};

export async function findSectorizacionByDni(dniActor: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT id_sectorizacion_actor, dni_actor_social, tipo_centro_poblado, centro_poblado, zona, mz, sector FROM sectorizacion_actor WHERE dni_actor_social = ? LIMIT 1",
    [dniActor],
  );
  return ((rows as any[])[0] as SectorizacionActor | undefined) ?? null;
}

export async function upsertSectorizacionByDni(params: {
  dniActor: string;
  tipoCentroPoblado?: string | null;
  centroPoblado?: string | null;
  zona?: string | null;
  mz?: string | null;
  sector?: string | null;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "INSERT INTO sectorizacion_actor (dni_actor_social, tipo_centro_poblado, centro_poblado, zona, mz, sector) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON DUPLICATE KEY UPDATE tipo_centro_poblado = VALUES(tipo_centro_poblado), centro_poblado = VALUES(centro_poblado), zona = VALUES(zona), mz = VALUES(mz), sector = VALUES(sector)",
    [
      params.dniActor,
      params.tipoCentroPoblado ?? null,
      params.centroPoblado ?? null,
      params.zona ?? null,
      params.mz ?? null,
      params.sector ?? null,
    ],
  );
  return res as any;
}

