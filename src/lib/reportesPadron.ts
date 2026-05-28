import { getDbPool } from "@/lib/db";

export type PadronReporteRow = {
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
  actor_nombre: string | null;
  responsable_nombre: string | null;
  ocurrencia_desc: string | null;
  ocurrencia2_desc: string | null;
};

export async function listPadronReporte(params: {
  ubigeos?: number[];
  tipovd: string | number;
  etapas: string[];
  limit?: number;
}) {
  const pool = getDbPool();
  const etapas = Array.from(
    new Set(
      (params.etapas ?? [])
        .map((e) => String(e ?? "").trim())
        .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e)),
    ),
  );
  if (!etapas.length) return [];

  const tipovd = String(params.tipovd ?? "").trim();
  if (tipovd !== "1" && tipovd !== "2") return [];

  const where: string[] = [
    "TRIM(COALESCE(pn.tipovd,'')) = ?",
    `pn.etapa IN (${etapas.map(() => "?").join(",")})`,
  ];
  const values: any[] = [tipovd, ...etapas];

  const ubigeos = Array.from(
    new Set((params.ubigeos ?? []).map((u) => Number(u)).filter((u) => Number.isFinite(u))),
  ) as number[];
  if (ubigeos.length === 1) {
    where.unshift("pn.ubigeo = ?");
    values.unshift(ubigeos[0]);
  } else if (ubigeos.length > 1) {
    where.unshift(`pn.ubigeo IN (${ubigeos.map(() => "?").join(",")})`);
    values.unshift(...ubigeos);
  }

  const vrUbigeoSql =
    ubigeos.length === 1
      ? "AND vr0.ubigeo = ?"
      : ubigeos.length > 1
        ? `AND vr0.ubigeo IN (${ubigeos.map(() => "?").join(",")})`
        : "";

  const queryValues: any[] = [
    ...etapas,
    ...(ubigeos.length ? ubigeos : []),
    ...values,
  ];

  const limit = Math.min(Math.max(params.limit ?? 200000, 1), 200000);

  const [rows] = await pool.query(
    `SELECT
        pn.idpn, pn.tipo, pn.rango, pn.ccpp, pn.zona, pn.mz, pn.direccion, pn.referencia, pn.codeess, pn.tipodoc,
        pn.dni, pn.nombres, pn.fecha_nac,
        pn.dnimadre, pn.appatmadre, pn.apmatmadre, pn.nombresmadre,
        pn.dni_padre, pn.nombre_padre,
        pn.idocurrencia, pn.idocurrencia2,
        pn.nuevadireccion, pn.nuevareferencia,
        pn.observacion, pn.obspadron,
        pn.actorsocial, pn.responsable,
        pn.telefono, pn.telefonopn,
        pn.adulto, pn.cantidada,
        pn.etapa, pn.estadovd, pn.fechacita, pn.nrovd,
        pn.eess_ua, pn.departamento, pn.provincia, pn.distrito,
        pn.codqr, pn.modovd, pn.tipovd,
        pn.lat, pn.lon, pn.lat2, pn.long2, pn.lat3, pn.long3,
        pn.fechamodificacion, pn.fechamodificacion2,
        pn.tamisaje, pn.hb, pn.anemia, pn.hierro, pn.tsf, pn.rsf,
        pn.visitadops, pn.sesiondem, pn.tieneps,
        pn.observacion2, pn.fechatamisaje,
        pn.tiposeguro, pn.tipodocum, pn.usuario,
        pn.ubigeo,
        pn.fecha_inicio_vd, pn.fecha_fin_vd,
        vr.estadosvd,
        vr.estadosvd2,
        vr.estadosvd3,
        vr.primera_vd,
        vr.segunda_vd,
        vr.tercera_vd,
        pn.resultado, pn.avance,
        pn.fotos, pn.programacion1, pn.padronnominal,
        pn.iddistrito, pn.discapacidad, pn.titular_linea, pn.codigov,
        pn.img_carnet, pn.estado_verificacion, pn.estado, pn.estado_verificado,
        pn.celularseapp, pn.tipodispositivo, pn.estadointervencion, pn.asignacion,
        pn.estadoseguro, pn.fecha_act_seguro, pn.nombre_comercial, pn.hbregistro, pn.ccred,
        TRIM(CONCAT(COALESCE(p_actor.nombrecompleto,''),' ',COALESCE(p_actor.apellidos,''))) AS actor_nombre,
        TRIM(CONCAT(COALESCE(p_resp.nombrecompleto,''),' ',COALESCE(p_resp.apellidos,''))) AS responsable_nombre,
        o1.descripcion AS ocurrencia_desc,
        o2.descripcion AS ocurrencia2_desc
     FROM padronnominal pn
     LEFT JOIN (
        SELECT
          ubigeo,
          etapa_mes,
          TRIM(dni_nino) AS dni_nino,
          MAX(CASE WHEN rn = 1 THEN fecha_intervencion END) AS primera_vd,
          MAX(CASE WHEN rn = 2 THEN fecha_intervencion END) AS segunda_vd,
          MAX(CASE WHEN rn = 3 THEN fecha_intervencion END) AS tercera_vd,
          MAX(CASE WHEN rn = 1 THEN etapa_text END) AS estadosvd,
          MAX(CASE WHEN rn = 2 THEN etapa_text END) AS estadosvd2,
          MAX(CASE WHEN rn = 3 THEN etapa_text END) AS estadosvd3
        FROM (
          SELECT
            vr0.ubigeo,
            vr0.etapa_mes,
            vr0.dni_nino,
            vr0.fecha_intervencion,
            vr0.etapa_text,
            ROW_NUMBER() OVER (
              PARTITION BY vr0.ubigeo, vr0.etapa_mes, TRIM(vr0.dni_nino)
              ORDER BY vr0.fecha_intervencion ASC
            ) AS rn
          FROM visitas_raw vr0
          WHERE vr0.etapa_mes IN (${etapas.map(() => "?").join(",")})
            ${vrUbigeoSql}
            AND vr0.fecha_intervencion IS NOT NULL
            AND (
              LOWER(COALESCE(vr0.etapa_text,'')) LIKE 'visita%'
              OR LOWER(COALESCE(vr0.etapa_text,'')) LIKE '%no encontrado%'
              OR LOWER(COALESCE(vr0.etapa_text,'')) LIKE '%rechaz%'
            )
        ) x
        WHERE rn <= 3
        GROUP BY ubigeo, etapa_mes, TRIM(dni_nino)
     ) vr ON vr.ubigeo = pn.ubigeo AND vr.etapa_mes = pn.etapa AND vr.dni_nino = TRIM(pn.dni)
     LEFT JOIN persona p_actor ON TRIM(p_actor.dni) = TRIM(pn.actorsocial)
     LEFT JOIN persona p_resp ON TRIM(p_resp.dni) = TRIM(pn.responsable)
     LEFT JOIN ocurrencias o1 ON o1.idocurrencias = pn.idocurrencia
     LEFT JOIN ocurrencias o2 ON o2.idocurrencias = pn.idocurrencia2
     WHERE ${where.join(" AND ")}
     ORDER BY pn.ubigeo ASC, pn.etapa DESC, pn.idpn ASC
     LIMIT ${limit}`,
    queryValues,
  );

  return rows as PadronReporteRow[];
}

