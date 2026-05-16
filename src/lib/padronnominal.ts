import { getDbPool } from "@/lib/db";

export async function updatePadronActorSocial(params: {
  ubigeo: number;
  etapa: string;
  actorAnterior: string;
  actorNuevo: string;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "UPDATE padronnominal SET actorsocial = ? WHERE etapa = ? AND ubigeo = ? AND actorsocial = ?",
    [params.actorNuevo, params.etapa, params.ubigeo, params.actorAnterior],
  );
  return res as any;
}

export async function countAsignadosPorActores(params: {
  ubigeo: number;
  etapa: string;
  actores: string[];
}) {
  if (!params.actores.length) return new Map<string, number>();
  const pool = getDbPool();
  const placeholders = params.actores.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT actorsocial as actor, COUNT(*) as c
     FROM padronnominal
     WHERE ubigeo = ? AND etapa = ? AND actorsocial IN (${placeholders})
     GROUP BY actorsocial`,
    [params.ubigeo, params.etapa, ...params.actores],
  );
  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const actor = String(r.actor ?? "").trim();
    if (!actor) continue;
    map.set(actor, Number(r.c ?? 0));
  }
  return map;
}

export type PadronAsignadoRow = {
  idpn: number;
  dni: string | null;
  nombres: string | null;
  fecha_nac: string | null;
  direccion: string | null;
  referencia: string | null;
  eess_ua: string | null;
  dnimadre: string | null;
  appatmadre: string | null;
  apmatmadre: string | null;
  nombresmadre: string | null;
  dni_padre: string | null;
  nombre_padre: string | null;
  telefonopn: string | null;
  telefono: string | null;
  primera_vd: string | null;
  segunda_vd: string | null;
  tercera_vd: string | null;
  fecha_fin_vd: string | null;
  fechamodificacion: string | null;
  fechamodificacion2: string | null;
};

export async function listAsignadosPorActor(params: {
  ubigeo: number;
  etapa: string;
  actor: string;
  limit?: number;
}) {
  const pool = getDbPool();
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 2000);
  const [rows] = await pool.query(
    `SELECT idpn, dni, nombres, fecha_nac, direccion, referencia, eess_ua,
            dnimadre, appatmadre, apmatmadre, nombresmadre,
            dni_padre, nombre_padre, telefonopn, telefono,
            primera_vd, segunda_vd, tercera_vd, fecha_fin_vd,
            fechamodificacion, fechamodificacion2
     FROM padronnominal
     WHERE ubigeo = ? AND etapa = ? AND actorsocial = ?
     ORDER BY idpn DESC
     LIMIT ${limit}`,
    [params.ubigeo, params.etapa, params.actor],
  );
  return rows as PadronAsignadoRow[];
}

export type PadronAsignadoPdfRow = {
  idpn: number;
  tipo: number | null;
  rango: string | null;
  ccpp: string | null;
  zona: number | null;
  mz: number | null;
  direccion: string | null;
  referencia: string | null;
  codeess: string | null;
  tipodoc: string | null;
  dni: string | null;
  nombres: string | null;
  fecha_nac: string | null;
  dnimadre: string | null;
  appatmadre: string | null;
  apmatmadre: string | null;
  nombresmadre: string | null;
  dni_padre: string | null;
  nombre_padre: string | null;
  idocurrencia: number | null;
  idocurrencia2: number | null;
  nuevadireccion: string | null;
  nuevareferencia: string | null;
  observacion: string | null;
  obspadron: string | null;
  actorsocial: string | null;
  responsable: string | null;
  telefono: string | null;
  telefonopn: string | null;
  adulto: number | null;
  cantidada: number | null;
  etapa: string;
  estadovd: string | null;
  fechacita: string | null;
  nrovd: number | null;
  eess_ua: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  codqr: string | null;
  modovd: number | null;
  tipovd: string | null;
  lat: string | null;
  lon: string | null;
  lat2: string | null;
  long2: string | null;
  lat3: string | null;
  long3: string | null;
  fechamodificacion: string | null;
  fechamodificacion2: string | null;
  tamisaje: number | null;
  hb: number | null;
  anemia: number | null;
  hierro: number | null;
  tsf: number | null;
  rsf: number | null;
  visitadops: number | null;
  sesiondem: number | null;
  tieneps: string | null;
  observacion2: string | null;
  fechatamisaje: string | null;
  tiposeguro: string | null;
  tipodocum: string | null;
  usuario: string | null;
  ubigeo: number | null;
  fecha_inicio_vd: string | null;
  fecha_fin_vd: string | null;
  estadosvd: string | null;
  estadosvd2: string | null;
  estadosvd3: string | null;
  primera_vd: string | null;
  segunda_vd: string | null;
  tercera_vd: string | null;
  resultado: number | null;
  avance: number | null;
  fotos: string | null;
  programacion1: string | null;
  padronnominal: string | null;
  iddistrito: number | null;
  discapacidad: number | null;
  titular_linea: string | null;
  codigov: string | null;
  img_carnet: string | null;
  estado_verificacion: string | null;
  estado: number | null;
  estado_verificado: number | null;
  celularseapp: string | null;
  tipodispositivo: string | null;
  estadointervencion: string | null;
  asignacion: string | null;
  estadoseguro: string | null;
  fecha_act_seguro: string | null;
  nombre_comercial: string | null;
  hbregistro: number | null;
  ccred: number | null;
};

export async function listAsignadosPorActorForPdf(params: {
  ubigeo: number;
  etapa: string;
  actor: string;
  limit?: number;
}) {
  const pool = getDbPool();
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 2000);
  const [rows] = await pool.query(
    `SELECT idpn, tipo, rango, ccpp, zona, mz, direccion, referencia, codeess, tipodoc, dni, nombres, fecha_nac,
            dnimadre, appatmadre, apmatmadre, nombresmadre, dni_padre, nombre_padre,
            idocurrencia, idocurrencia2, nuevadireccion, nuevareferencia, observacion, obspadron,
            actorsocial, responsable, telefono, telefonopn, adulto, cantidada, etapa, estadovd, fechacita, nrovd,
            eess_ua, departamento, provincia, distrito, codqr, modovd, tipovd, lat, lon, lat2, long2, lat3, long3,
            fechamodificacion, fechamodificacion2, tamisaje, hb, anemia, hierro, tsf, rsf, visitadops, sesiondem,
            tieneps, observacion2, fechatamisaje, tiposeguro, tipodocum, usuario, ubigeo,
            fecha_inicio_vd, fecha_fin_vd, estadosvd, estadosvd2, estadosvd3,
            primera_vd, segunda_vd, tercera_vd, resultado, avance, fotos, programacion1, padronnominal,
            iddistrito, discapacidad, titular_linea, codigov, img_carnet, estado_verificacion, estado, estado_verificado,
            celularseapp, tipodispositivo, estadointervencion, asignacion, estadoseguro, fecha_act_seguro,
            nombre_comercial, hbregistro, ccred
     FROM padronnominal
     WHERE ubigeo = ? AND etapa = ? AND actorsocial = ?
     ORDER BY idpn DESC
     LIMIT ${limit}`,
    [params.ubigeo, params.etapa, params.actor],
  );
  return rows as PadronAsignadoPdfRow[];
}

export async function updatePadronResponsable(params: {
  ubigeo: number;
  etapa: string;
  responsableAnterior: string;
  responsableNuevo: string;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "UPDATE padronnominal SET responsable = ? WHERE etapa = ? AND ubigeo = ? AND responsable = ?",
    [
      params.responsableNuevo,
      params.etapa,
      params.ubigeo,
      params.responsableAnterior,
    ],
  );
  return res as any;
}

export type PadronRow = {
  idpn: number;
  dni: string | null;
  nombres: string | null;
  direccion: string | null;
  referencia: string | null;
  eess_ua: string | null;
  actorsocial: string | null;
  responsable: string | null;
};

export async function searchPadronNominal(params: {
  ubigeo: number;
  etapa: string;
  q?: string;
  asignados?: "all" | "assigned" | "unassigned";
  limit?: number;
}) {
  const pool = getDbPool();
  const where: string[] = ["ubigeo = ?", "etapa = ?"];
  const values: any[] = [params.ubigeo, params.etapa];

  if (params.asignados === "unassigned") {
    where.push("(actorsocial IS NULL OR TRIM(actorsocial) = '' OR TRIM(actorsocial) = '0')");
  } else if (params.asignados === "assigned") {
    where.push("(actorsocial IS NOT NULL AND TRIM(actorsocial) <> '' AND TRIM(actorsocial) <> '0')");
  }

  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`;
    where.push(
      "(dni LIKE ? OR direccion LIKE ? OR referencia LIKE ? OR eess_ua LIKE ?)",
    );
    values.push(like, like, like, like);
  }

  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);
  const [rows] = await pool.query(
    `SELECT idpn, dni, nombres, direccion, referencia, eess_ua, actorsocial, responsable
     FROM padronnominal
     WHERE ${where.join(" AND ")}
     ORDER BY idpn DESC
     LIMIT ${limit}`,
    values,
  );
  return rows as PadronRow[];
}

export async function countAsignadosActor(params: {
  ubigeo: number;
  etapa: string;
  actor: string;
}) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT COUNT(*) as c FROM padronnominal WHERE ubigeo = ? AND etapa = ? AND actorsocial = ?",
    [params.ubigeo, params.etapa, params.actor],
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function countSeleccionYaAsignado(params: {
  ubigeo: number;
  etapa: string;
  actor: string;
  ids: number[];
}) {
  if (!params.ids.length) return 0;
  const pool = getDbPool();
  const placeholders = params.ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM padronnominal WHERE ubigeo = ? AND etapa = ? AND actorsocial = ? AND idpn IN (${placeholders})`,
    [params.ubigeo, params.etapa, params.actor, ...params.ids],
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function countIdsEnEtapaUbigeo(params: {
  ubigeo: number;
  etapa: string;
  ids: number[];
}) {
  if (!params.ids.length) return 0;
  const pool = getDbPool();
  const placeholders = params.ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM padronnominal WHERE ubigeo = ? AND etapa = ? AND idpn IN (${placeholders})`,
    [params.ubigeo, params.etapa, ...params.ids],
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function asignarPadron(params: {
  ubigeo: number;
  etapa: string;
  ids: number[];
  actor: string;
  responsable: string;
}) {
  if (!params.ids.length) return { affectedRows: 0 };
  const pool = getDbPool();
  const placeholders = params.ids.map(() => "?").join(",");
  const [res] = await pool.query(
    `UPDATE padronnominal SET actorsocial = ?, responsable = ? WHERE ubigeo = ? AND etapa = ? AND idpn IN (${placeholders})`,
    [params.actor, params.responsable, params.ubigeo, params.etapa, ...params.ids],
  );
  return res as any;
}

export async function countPadronPorUbigeoEtapaTipovd(params: {
  ubigeos: number[];
  tipovd?: string;
}) {
  const pool = getDbPool();
  const ubigeos = params.ubigeos.filter((u) => Number.isFinite(u));
  if (!ubigeos.length) return new Map<string, number>();
  const placeholders = ubigeos.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT ubigeo, DATE_FORMAT(etapa, '%Y-%m-01') as etapa, COUNT(*) as c
     FROM padronnominal
     WHERE ubigeo IN (${placeholders}) AND CAST(NULLIF(TRIM(tipovd), '') AS UNSIGNED) = 1
     GROUP BY ubigeo, DATE_FORMAT(etapa, '%Y-%m-01')`,
    ubigeos,
  );
  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const u = Number(r.ubigeo ?? NaN);
    const etapa = String(r.etapa ?? "").slice(0, 10);
    if (!Number.isFinite(u) || !etapa) continue;
    map.set(`${u}|${etapa}`, Number(r.c ?? 0));
  }
  return map;
}

export async function deletePadronByUbigeoEtapa(params: {
  ubigeo: number;
  etapa: string;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "DELETE FROM padronnominal WHERE ubigeo = ? AND etapa = ?",
    [params.ubigeo, params.etapa],
  );
  return res as any;
}
