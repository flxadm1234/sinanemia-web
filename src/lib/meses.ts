import { getDbPool } from "@/lib/db";

export async function getEtapaSeleccionadaPorUbigeo(ubigeo: number | string) {
  const pool = getDbPool();
  const ubigeoStr = String(ubigeo);
  const [rows] = await pool.query(
    "SELECT numero_mes, year FROM meses WHERE ubigeo = ? AND seleccion = 1 ORDER BY year DESC, numero_mes DESC LIMIT 1",
    [ubigeoStr],
  );
  const row = (rows as any[])[0] as { numero_mes: number; year: number } | undefined;
  if (!row) return null;

  const mm = String(row.numero_mes).padStart(2, "0");
  const etapa = `${row.year}-${mm}-01`;
  return { numero_mes: row.numero_mes, year: row.year, etapa };
}

