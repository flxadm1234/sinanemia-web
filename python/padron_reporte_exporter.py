import argparse
import json
import os
import sys
from datetime import datetime

import mysql.connector
from dotenv import load_dotenv
from openpyxl import Workbook


def log_line(msg: str):
    p = os.getenv("PADRON_REPORTE_LOG_PATH", "").strip()
    if not p:
        return
    try:
        with open(p, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.utcnow().isoformat(timespec='seconds')}Z] {msg}\n")
    except Exception:
        pass


def connect_db():
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "")
    password = os.getenv("DB_PASSWORD", "")
    database = os.getenv("DB_NAME", "")
    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        autocommit=False,
    )


def normalize_etapas(raw):
    etapas = []
    for x in raw or []:
        s = str(x or "").strip()
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            etapas.append(s)
    return list(dict.fromkeys(etapas))


def normalize_ubigeos(raw):
    ub = []
    for x in raw or []:
        try:
            n = int(str(x).strip())
            ub.append(n)
        except Exception:
            pass
    return list(dict.fromkeys(ub))


def job_update(cur, job_id: int, status: str, progress: int, message: str = None, file_path: str = None):
    cur.execute(
        "UPDATE report_export_jobs SET status=%s, progress=%s, message=%s, file_path=%s WHERE id=%s",
        (status, int(progress), message, file_path, int(job_id)),
    )


def build_query(tipo: str, etapas: list, ubigeos: list):
    where = ["TRIM(COALESCE(pn0.tipovd,'')) = %s", f"pn0.etapa IN ({','.join(['%s'] * len(etapas))})"]
    values = [tipo] + etapas[:]

    if len(ubigeos) == 1:
        where.insert(0, "pn0.ubigeo = %s")
        values.insert(0, ubigeos[0])
    elif len(ubigeos) > 1:
        where.insert(0, f"pn0.ubigeo IN ({','.join(['%s'] * len(ubigeos))})")
        values = ubigeos[:] + values

    vr_ubigeo_sql = ""
    if len(ubigeos) == 1:
        vr_ubigeo_sql = "AND vr0.ubigeo = %s"
    elif len(ubigeos) > 1:
        vr_ubigeo_sql = f"AND vr0.ubigeo IN ({','.join(['%s'] * len(ubigeos))})"

    where_pn2 = [w.replace("pn0.", "pn2.") for w in where]
    values_pn2 = values[:]

    query_values = []
    query_values.extend(values)
    query_values.extend(etapas)
    if len(ubigeos) > 0:
        query_values.extend(ubigeos)
    query_values.extend(values_pn2)

    limit = 2000000

    sql = f"""
WITH pdj AS (
  SELECT ubigeo, periodo, job_id
  FROM (
    SELECT
      ubigeo,
      periodo,
      id AS job_id,
      ROW_NUMBER() OVER (
        PARTITION BY ubigeo, periodo
        ORDER BY fecha_corte DESC, created_at DESC, id DESC
      ) AS rn
    FROM padron_dni_import_jobs
    WHERE status = 'done'
  ) x
  WHERE rn = 1
),
pdrx AS (
  SELECT *
  FROM (
    SELECT
      r0.id,
      r0.job_id,
      NULLIF(TRIM(COALESCE(r0.dni,'')), '') AS dni_stored,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[3]'))), '') AS cnv_key,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[5]'))), '') AS dni_key,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[2]'))), '') AS codpad_key,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[8]'))), '') AS nino_appat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[9]'))), '') AS nino_apmat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[10]'))), '') AS nino_nombres,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[44]'))), '') AS madre_dni,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[45]'))), '') AS madre_appat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[46]'))), '') AS madre_apmat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[47]'))), '') AS madre_nombres,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[48]'))), '') AS madre_celular,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[54]'))), '') AS jefe_dni,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[55]'))), '') AS jefe_appat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[56]'))), '') AS jefe_apmat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[57]'))), '') AS jefe_nombres,
      ROW_NUMBER() OVER (
        PARTITION BY
          r0.job_id,
          COALESCE(
            NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[3]'))), ''),
            NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[5]'))), ''),
            NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[2]'))), ''),
            NULLIF(TRIM(COALESCE(r0.dni,'')), '')
          )
        ORDER BY r0.id DESC
      ) AS rn_key
    FROM padron_dni_raw r0
    JOIN pdj ON pdj.job_id = r0.job_id
    WHERE JSON_VALID(r0.payload)
  ) y
  WHERE rn_key = 1
)
SELECT
  pn.idpn, pn.tipo, pn.rango, pn.ccpp, pn.zona, pn.mz, pn.direccion, pn.referencia, pn.codeess, pn.tipodoc,
  pn.dni,
  COALESCE(
    NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.nombres,''))), 'NULL'), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pdr_cnv.nino_appat, pdr_cnv.nino_apmat, pdr_cnv.nino_nombres)), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pdr_dni.nino_appat, pdr_dni.nino_apmat, pdr_dni.nino_nombres)), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pdr_cod.nino_appat, pdr_cod.nino_apmat, pdr_cod.nino_nombres)), '')
  ) AS nombres,
  pn.fecha_nac,
  COALESCE(NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.dnimadre,''))), 'NULL'), ''), pdr_cnv.madre_dni, pdr_dni.madre_dni, pdr_cod.madre_dni) AS dnimadre,
  COALESCE(NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.appatmadre,''))), 'NULL'), ''), pdr_cnv.madre_appat, pdr_dni.madre_appat, pdr_cod.madre_appat) AS appatmadre,
  COALESCE(NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.apmatmadre,''))), 'NULL'), ''), pdr_cnv.madre_apmat, pdr_dni.madre_apmat, pdr_cod.madre_apmat) AS apmatmadre,
  COALESCE(NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.nombresmadre,''))), 'NULL'), ''), pdr_cnv.madre_nombres, pdr_dni.madre_nombres, pdr_cod.madre_nombres) AS nombresmadre,
  COALESCE(NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.dni_padre,''))), 'NULL'), ''), pdr_cnv.jefe_dni, pdr_dni.jefe_dni, pdr_cod.jefe_dni) AS dni_padre,
  COALESCE(
    NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.nombre_padre,''))), 'NULL'), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pdr_cnv.jefe_appat, pdr_cnv.jefe_apmat, pdr_cnv.jefe_nombres)), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pdr_dni.jefe_appat, pdr_dni.jefe_apmat, pdr_dni.jefe_nombres)), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pdr_cod.jefe_appat, pdr_cod.jefe_apmat, pdr_cod.jefe_nombres)), '')
  ) AS nombre_padre,
  pn.idocurrencia, pn.idocurrencia2,
  pn.nuevadireccion, pn.nuevareferencia,
  pn.observacion, pn.obspadron,
  pn.actorsocial, pn.responsable,
  pn.telefono,
  COALESCE(NULLIF(NULLIF(UPPER(TRIM(COALESCE(pn.telefonopn,''))), 'NULL'), ''), pdr_cnv.madre_celular, pdr_dni.madre_celular, pdr_cod.madre_celular) AS telefonopn,
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
  vr.estadosvd, vr.estadosvd2, vr.estadosvd3,
  vr.primera_vd, vr.segunda_vd, vr.tercera_vd,
  tam.fecha_atencion AS tam_fecha_atencion,
  tam.hemoglobina AS tam_hemoglobina,
  tam.peso AS tam_peso,
  tam.talla AS tam_talla,
  tam.cie_10 AS tam_cie_10,
  tam.resultado AS tam_resultado,
  tam.hemoglobina1, tam.fecha_atencion1,
  tam.hemoglobina2, tam.fecha_atencion2,
  tam.hemoglobina3, tam.fecha_atencion3,
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
FROM (
  SELECT
    pn0.*,
    ROW_NUMBER() OVER (
      PARTITION BY pn0.ubigeo, pn0.etapa, TRIM(pn0.dni)
      ORDER BY pn0.idpn DESC
    ) AS rn_pn
  FROM padronnominal pn0
  WHERE {" AND ".join(where)}
) pn
LEFT JOIN pdj ON pdj.ubigeo = pn.ubigeo AND pdj.periodo = DATE(pn.etapa)
LEFT JOIN pdrx pdr_cnv ON pdr_cnv.job_id = pdj.job_id AND pdr_cnv.cnv_key = TRIM(pn.dni)
LEFT JOIN pdrx pdr_dni ON pdr_dni.job_id = pdj.job_id AND pdr_dni.dni_key = TRIM(pn.dni)
LEFT JOIN pdrx pdr_cod ON pdr_cod.job_id = pdj.job_id AND pdr_cod.codpad_key = TRIM(pn.dni)
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
      y.ubigeo,
      y.etapa_mes,
      y.dni_nino,
      y.fecha_intervencion,
      y.etapa_text,
      ROW_NUMBER() OVER (
        PARTITION BY y.ubigeo, y.etapa_mes, y.dni_nino
        ORDER BY y.fecha_intervencion ASC
      ) AS rn
    FROM (
      SELECT
        d.ubigeo,
        d.etapa_mes,
        d.dni_nino,
        d.fecha_intervencion,
        d.etapa_text
      FROM (
        SELECT
          vr0.ubigeo,
          vr0.etapa_mes,
          TRIM(vr0.dni_nino) AS dni_nino,
          DATE(vr0.fecha_intervencion) AS fecha_intervencion,
          vr0.etapa_text,
          ROW_NUMBER() OVER (
            PARTITION BY vr0.ubigeo, vr0.etapa_mes, TRIM(vr0.dni_nino), DATE(vr0.fecha_intervencion)
            ORDER BY
              CASE
                WHEN LOWER(COALESCE(vr0.etapa_text,'')) LIKE 'visita%' THEN 3
                WHEN LOWER(COALESCE(vr0.etapa_text,'')) LIKE '%no encontrado%' THEN 2
                WHEN LOWER(COALESCE(vr0.etapa_text,'')) LIKE '%rechaz%' THEN 1
                ELSE 0
              END DESC,
              vr0.fecha_intervencion ASC
          ) AS rn_day
        FROM visitas_raw vr0
        WHERE vr0.etapa_mes IN ({','.join(['%s'] * len(etapas))})
          {vr_ubigeo_sql}
          AND vr0.fecha_intervencion IS NOT NULL
          AND (
            LOWER(COALESCE(vr0.etapa_text,'')) LIKE 'visita%'
            OR LOWER(COALESCE(vr0.etapa_text,'')) LIKE '%no encontrado%'
            OR LOWER(COALESCE(vr0.etapa_text,'')) LIKE '%rechaz%'
          )
      ) d
      WHERE d.rn_day = 1
    ) y
  ) x
  WHERE rn <= 3
  GROUP BY ubigeo, etapa_mes, TRIM(dni_nino)
) vr ON vr.ubigeo = pn.ubigeo AND vr.etapa_mes = pn.etapa AND vr.dni_nino = TRIM(pn.dni)
LEFT JOIN (
  SELECT
    dni,
    MAX(CASE WHEN rn = 1 THEN fecha_atencion END) AS fecha_atencion,
    MAX(CASE WHEN rn = 1 THEN hemoglobina END) AS hemoglobina,
    MAX(CASE WHEN rn = 1 THEN peso END) AS peso,
    MAX(CASE WHEN rn = 1 THEN talla END) AS talla,
    MAX(CASE WHEN rn = 1 THEN cie_10 END) AS cie_10,
    MAX(CASE WHEN rn = 1 THEN resultado END) AS resultado,
    MAX(CASE WHEN rn = 1 THEN hemoglobina END) AS hemoglobina1,
    MAX(CASE WHEN rn = 1 THEN fecha_atencion END) AS fecha_atencion1,
    MAX(CASE WHEN rn = 2 THEN hemoglobina END) AS hemoglobina2,
    MAX(CASE WHEN rn = 2 THEN fecha_atencion END) AS fecha_atencion2,
    MAX(CASE WHEN rn = 3 THEN hemoglobina END) AS hemoglobina3,
    MAX(CASE WHEN rn = 3 THEN fecha_atencion END) AS fecha_atencion3
  FROM (
    SELECT
      TRIM(rt.dni) AS dni,
      DATE(rt.fecha_atencion) AS fecha_atencion,
      rt.hemoglobina,
      rt.peso,
      rt.talla,
      rt.cie_10,
      rt.resultado,
      ROW_NUMBER() OVER (
        PARTITION BY TRIM(rt.dni)
        ORDER BY rt.fecha_atencion DESC, rt.id DESC
      ) AS rn
    FROM registro_tamizaje rt
    JOIN (
      SELECT DISTINCT TRIM(pn2.dni) AS dni
      FROM padronnominal pn2
      WHERE {" AND ".join(where_pn2)}
    ) dnis ON dnis.dni = TRIM(rt.dni)
    WHERE rt.fecha_atencion IS NOT NULL
  ) t
  WHERE rn <= 3
  GROUP BY dni
) tam ON tam.dni = TRIM(pn.dni)
LEFT JOIN (
  SELECT dni, nombrecompleto, apellidos
  FROM (
    SELECT TRIM(p.dni) AS dni, p.nombrecompleto, p.apellidos,
           ROW_NUMBER() OVER (PARTITION BY TRIM(p.dni) ORDER BY p.idpersona DESC) AS rn_persona
    FROM persona p
    WHERE TRIM(COALESCE(p.dni,'')) <> ''
  ) x
  WHERE rn_persona = 1
) p_actor ON p_actor.dni = TRIM(pn.actorsocial)
LEFT JOIN (
  SELECT dni, nombrecompleto, apellidos
  FROM (
    SELECT TRIM(p.dni) AS dni, p.nombrecompleto, p.apellidos,
           ROW_NUMBER() OVER (PARTITION BY TRIM(p.dni) ORDER BY p.idpersona DESC) AS rn_persona
    FROM persona p
    WHERE TRIM(COALESCE(p.dni,'')) <> ''
  ) x
  WHERE rn_persona = 1
) p_resp ON p_resp.dni = TRIM(pn.responsable)
LEFT JOIN ocurrencias o1 ON o1.idocurrencias = pn.idocurrencia
LEFT JOIN ocurrencias o2 ON o2.idocurrencias = pn.idocurrencia2
WHERE pn.rn_pn = 1
ORDER BY pn.ubigeo ASC, pn.etapa DESC, pn.idpn ASC
LIMIT {limit}
"""

    return sql, query_values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job_id", required=True, type=int)
    parser.add_argument("--out_path", required=True, type=str)
    args = parser.parse_args()

    load_dotenv(os.path.join(os.getcwd(), ".env.local"))

    job_id = int(args.job_id)
    out_path = str(args.out_path)

    db = connect_db()
    cur = db.cursor()
    try:
        cur.execute("SELECT params_json FROM report_export_jobs WHERE id=%s LIMIT 1", (job_id,))
        row = cur.fetchone()
        if not row:
            return 2
        params = json.loads(row[0] or "{}")
        tipo = str(params.get("tipo") or "").strip()
        etapas = normalize_etapas(params.get("etapas") or [])
        ubigeos = normalize_ubigeos(params.get("ubigeos") or [])
        if tipo not in ("1", "2") or not etapas:
            job_update(cur, job_id, "failed", 100, "Parámetros inválidos", None)
            db.commit()
            return 2

        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        job_update(cur, job_id, "running", 1, "Preparando exportación", None)
        db.commit()
        log_line(f"Job {job_id}: iniciando")

        sql, values = build_query(tipo, etapas, ubigeos)
        job_update(cur, job_id, "running", 5, "Ejecutando consulta", None)
        db.commit()

        cur_stream = db.cursor(buffered=False)
        cur_stream.execute(sql, tuple(values))

        wb = Workbook(write_only=True)
        ws = wb.create_sheet("Padron")

        headers = [d[0] for d in (cur_stream.description or [])]
        ws.append(headers)

        written = 0
        last_update = 0
        while True:
            batch = cur_stream.fetchmany(500)
            if not batch:
                break
            for r in batch:
                ws.append([("" if v is None else v) for v in r])
                written += 1
            if written - last_update >= 5000:
                last_update = written
                job_update(cur, job_id, "running", 10, f"Escribiendo filas: {written}", None)
                db.commit()
                log_line(f"Job {job_id}: filas={written}")

        wb.save(out_path)
        job_update(cur, job_id, "done", 100, f"Listo. Filas: {written}", out_path)
        db.commit()
        log_line(f"Job {job_id}: terminado filas={written}")
        return 0
    except Exception as e:
        try:
            job_update(cur, job_id, "failed", 100, f"Error: {str(e)[:450]}", None)
            db.commit()
        except Exception:
            pass
        log_line(f"Job {job_id}: error {e}")
        return 1
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
