import { getDbPool } from "@/lib/db";

export type ConsultaTamizajePersona = {
  dni: string;
  nombrecompleto: string | null;
  apellidos: string | null;
  telefono: string | null;
  tipo: string | null;
  ubigeo: number | null;
};

export type ConsultaTamizajePadronRow = {
  idpn: number;
  dni: string;
  nombres: string | null;
  fecha_nac: string | null;
  etapa: string | null;
  ubigeo: number | null;
  eess_ua: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  actorsocial_dni: string | null;
  actorsocial_nombre: string | null;
  responsable_dni: string | null;
  responsable_nombre: string | null;
};

export type ConsultaTamizajeRegistroRow = {
  id: number;
  dni: string | null;
  id_cita: number | null;
  lote: string | null;
  ups: string | null;
  nombre_personal: string | null;
  nombre_registrador: string | null;
  periodo: number | null;
  renaes: string | null;
  red: string | null;
  microred: string | null;
  provincia: string | null;
  distrito: string | null;
  tipo_documento: string | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  fecha_atencion: string | null;
  peso: string | null;
  talla: string | null;
  hemoglobina: string | null;
  grupo_riesgo_desc: string | null;
  condicion_gestante: string | null;
  tipo_edad_pac: string | null;
  anio_actual_pac: number | null;
  mes_actual_pac: number | null;
  dia_actual_pac: number | null;
  nombre_establecimiento: string | null;
  cie_10: string | null;
  diagnostico: string | null;
  lab1: string | null;
  lab2: string | null;
  lab3: string | null;
  resultado: string | null;
  total: number | null;
  fecha_registro: string | null;
  created_at: string | null;
};

export type ConsultaTamizajeResult = {
  dni: string;
  padron: ConsultaTamizajePadronRow[];
  tamizajes: ConsultaTamizajeRegistroRow[];
};

function toIsoDate(v: unknown) {
  if (!v) return null;
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function toIsoDateTime(v: unknown) {
  if (!v) return null;
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 19).replace("T", " ");
  const s = String(v).trim();
  if (!s) return null;
  return s.length >= 19 ? s.slice(0, 19) : s;
}

export async function consultaTamizajePorDni(params: { dni: string; ubigeo?: number | null }) {
  const dni = String(params.dni ?? "").trim();
  if (!dni) return null;

  const pool = getDbPool();
  const wherePadron: string[] = ["TRIM(COALESCE(pn.dni,'')) = TRIM(?)"];
  const values: any[] = [dni];
  if (typeof params.ubigeo === "number" && Number.isFinite(params.ubigeo)) {
    wherePadron.push("pn.ubigeo = ?");
    values.push(params.ubigeo);
  }

  const [padronRows] = await pool.query(
    `SELECT
      pn.idpn,
      TRIM(COALESCE(pn.dni,'')) AS dni,
      pn.nombres,
      pn.fecha_nac,
      pn.etapa,
      pn.ubigeo,
      pn.eess_ua,
      pn.departamento,
      pn.provincia,
      pn.distrito,
      TRIM(COALESCE(pn.actorsocial,'')) AS actorsocial_dni,
      CONCAT_WS(' ', p_actor.apellidos, p_actor.nombrecompleto) AS actorsocial_nombre,
      TRIM(COALESCE(pn.responsable,'')) AS responsable_dni,
      CONCAT_WS(' ', p_resp.apellidos, p_resp.nombrecompleto) AS responsable_nombre
     FROM padronnominal pn
     LEFT JOIN (
        SELECT dni, nombrecompleto, apellidos
        FROM (
          SELECT
            TRIM(p.dni) AS dni,
            p.nombrecompleto,
            p.apellidos,
            ROW_NUMBER() OVER (
              PARTITION BY TRIM(p.dni)
              ORDER BY p.idpersona DESC
            ) AS rn_persona
          FROM persona p
          WHERE TRIM(COALESCE(p.dni,'')) <> ''
        ) x
        WHERE rn_persona = 1
     ) p_actor ON p_actor.dni = TRIM(pn.actorsocial)
     LEFT JOIN (
        SELECT dni, nombrecompleto, apellidos
        FROM (
          SELECT
            TRIM(p.dni) AS dni,
            p.nombrecompleto,
            p.apellidos,
            ROW_NUMBER() OVER (
              PARTITION BY TRIM(p.dni)
              ORDER BY p.idpersona DESC
            ) AS rn_persona
          FROM persona p
          WHERE TRIM(COALESCE(p.dni,'')) <> ''
        ) x
        WHERE rn_persona = 1
     ) p_resp ON p_resp.dni = TRIM(pn.responsable)
     WHERE ${wherePadron.join(" AND ")}
     ORDER BY pn.etapa DESC, pn.idpn DESC`,
    values,
  );

  const padron = (padronRows as any[]).map(
    (r) =>
      ({
        idpn: Number(r.idpn ?? 0),
        dni: String(r.dni ?? "").trim(),
        nombres: r.nombres == null ? null : String(r.nombres),
        fecha_nac: toIsoDate(r.fecha_nac),
        etapa: toIsoDate(r.etapa),
        ubigeo: r.ubigeo == null ? null : Number(r.ubigeo),
        eess_ua: r.eess_ua == null ? null : String(r.eess_ua),
        departamento: r.departamento == null ? null : String(r.departamento),
        provincia: r.provincia == null ? null : String(r.provincia),
        distrito: r.distrito == null ? null : String(r.distrito),
        actorsocial_dni: r.actorsocial_dni ? String(r.actorsocial_dni) : null,
        actorsocial_nombre: r.actorsocial_nombre ? String(r.actorsocial_nombre) : null,
        responsable_dni: r.responsable_dni ? String(r.responsable_dni) : null,
        responsable_nombre: r.responsable_nombre ? String(r.responsable_nombre) : null,
      }) satisfies ConsultaTamizajePadronRow,
  );

  if (!padron.length) return null;

  const [tamRows] = await pool.query(
    `SELECT *
     FROM registro_tamizaje
     WHERE TRIM(COALESCE(dni,'')) = TRIM(?)
     ORDER BY fecha_atencion DESC, id DESC`,
    [dni],
  );

  const tamizajes = (tamRows as any[]).map(
    (r) =>
      ({
        id: Number(r.id ?? 0),
        dni: r.dni == null ? null : String(r.dni),
        id_cita: r.id_cita == null ? null : Number(r.id_cita),
        lote: r.lote == null ? null : String(r.lote),
        ups: r.ups == null ? null : String(r.ups),
        nombre_personal: r.nombre_personal == null ? null : String(r.nombre_personal),
        nombre_registrador: r.nombre_registrador == null ? null : String(r.nombre_registrador),
        periodo: r.periodo == null ? null : Number(r.periodo),
        renaes: r.renaes == null ? null : String(r.renaes),
        red: r.red == null ? null : String(r.red),
        microred: r.microred == null ? null : String(r.microred),
        provincia: r.provincia == null ? null : String(r.provincia),
        distrito: r.distrito == null ? null : String(r.distrito),
        tipo_documento: r.tipo_documento == null ? null : String(r.tipo_documento),
        sexo: r.sexo == null ? null : String(r.sexo),
        fecha_nacimiento: toIsoDate(r.fecha_nacimiento),
        fecha_atencion: toIsoDate(r.fecha_atencion),
        peso: r.peso == null ? null : String(r.peso),
        talla: r.talla == null ? null : String(r.talla),
        hemoglobina: r.hemoglobina == null ? null : String(r.hemoglobina),
        grupo_riesgo_desc: r.grupo_riesgo_desc == null ? null : String(r.grupo_riesgo_desc),
        condicion_gestante: r.condicion_gestante == null ? null : String(r.condicion_gestante),
        tipo_edad_pac: r.tipo_edad_pac == null ? null : String(r.tipo_edad_pac),
        anio_actual_pac: r.anio_actual_pac == null ? null : Number(r.anio_actual_pac),
        mes_actual_pac: r.mes_actual_pac == null ? null : Number(r.mes_actual_pac),
        dia_actual_pac: r.dia_actual_pac == null ? null : Number(r.dia_actual_pac),
        nombre_establecimiento: r.nombre_establecimiento == null ? null : String(r.nombre_establecimiento),
        cie_10: r.cie_10 == null ? null : String(r.cie_10),
        diagnostico: r.diagnostico == null ? null : String(r.diagnostico),
        lab1: r.lab1 == null ? null : String(r.lab1),
        lab2: r.lab2 == null ? null : String(r.lab2),
        lab3: r.lab3 == null ? null : String(r.lab3),
        resultado: r.resultado == null ? null : String(r.resultado),
        total: r.total == null ? null : Number(r.total),
        fecha_registro: toIsoDateTime(r.fecha_registro),
        created_at: toIsoDateTime(r.created_at),
      }) satisfies ConsultaTamizajeRegistroRow,
  );

  return {
    dni,
    padron,
    tamizajes,
  } satisfies ConsultaTamizajeResult;
}

