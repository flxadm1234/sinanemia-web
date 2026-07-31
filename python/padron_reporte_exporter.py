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
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[54]'))), '') AS padre_dni,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[55]'))), '') AS padre_appat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[56]'))), '') AS padre_apmat,
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(r0.payload, '$[57]'))), '') AS padre_nombres,
      r0.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY r0.job_id, COALESCE(NULLIF(TRIM(COALESCE(r0.dni,'')),''), r0.id)
        ORDER BY r0.created_at DESC, r0.id DESC
      ) AS rn
    FROM padron_dni_raw r0
    WHERE JSON_VALID(r0.payload)
  ) x
  WHERE rn = 1
),
pdr_cnv AS (
  SELECT *
  FROM (
    SELECT
      pdrx.*,
      ROW_NUMBER() OVER (
        PARTITION BY pdrx.job_id, pdrx.cnv_key
        ORDER BY pdrx.created_at DESC, pdrx.id DESC
      ) AS rn_key
    FROM pdrx
    WHERE pdrx.cnv_key IS NOT NULL
  ) x
  WHERE rn_key = 1
),
pdr_dni AS (
  SELECT *
  FROM (
    SELECT
      pdrx.*,
      ROW_NUMBER() OVER (
        PARTITION BY pdrx.job_id, pdrx.dni_key
        ORDER BY pdrx.created_at DESC, pdrx.id DESC
      ) AS rn_key
    FROM pdrx
    WHERE pdrx.dni_key IS NOT NULL
  ) x
  WHERE rn_key = 1
),
pdr_cod AS (
  SELECT *
  FROM (
    SELECT
      pdrx.*,
      ROW_NUMBER() OVER (
        PARTITION BY pdrx.job_id, pdrx.codpad_key
        ORDER BY pdrx.created_at DESC, pdrx.id DESC
      ) AS rn_key
    FROM pdrx
    WHERE pdrx.codpad_key IS NOT NULL
  ) x
  WHERE rn_key = 1
),
pn0 AS (
  SELECT
    pn.idpn,
    pn.tipo,
    pn.rango,
    pn.ccpp,
    pn.zona,
    pn.mz,
    pn.direccion,
    pn.referencia,
    pn.codeess,
    pn.tipodoc,
    pn.dni,
    pn.nombres,
    pn.fecha_nac,
    pn.dnimadre,
    pn.appatmadre,
    pn.apmatmadre,
    pn.nombresmadre,
    pn.dni_padre,
    pn.nombre_padre,
    pn.idocurrencia,
    pn.idocurrencia2,
    pn.nuevadireccion,
    pn.nuevareferencia,
    pn.observacion,
    pn.obspadron,
    pn.actorsocial,
    pn.responsable,
    pn.telefono,
    pn.telefonopn,
    pn.adulto,
    pn.cantidada,
    pn.etapa,
    pn.estadovd,
    pn.fechacita,
    pn.nrovd,
    pn.eess_ua,
    pn.departamento,
    pn.provincia,
    pn.distrito,
    pn.codqr,
    pn.modovd,
    pn.tipovd,
    pn.lat,
    pn.lon,
    pn.lat2,
    pn.long2,
    pn.lat3,
    pn.long3,
    pn.fechamodificacion,
    pn.fechamodificacion2,
    pn.tamisaje,
    pn.hb,
    pn.anemia,
    pn.hierro,
    pn.tsf,
    pn.rsf,
    pn.visitadops,
    pn.sesiondem,
    pn.tieneps,
    pn.observacion2,
    pn.fechatamisaje,
    pn.tiposeguro,
    pn.tipodocum,
    pn.usuario,
    pn.ubigeo,
    pn.fecha_inicio_vd,
    pn.fecha_fin_vd,
    pn.estadosvd,
    pn.estadosvd2,
    pn.estadosvd3,
    pn.primera_vd,
    pn.segunda_vd,
    pn.tercera_vd,
    pn.tam_fecha_atencion,
    pn.tam_hemoglobina,
    pn.tam_peso,
    pn.tam_talla,
    pn.tam_cie_10,
    pn.tam_resultado,
    pn.hemoglobina1,
    pn.fecha_atencion1,
    pn.hemoglobina2,
    pn.fecha_atencion2,
    pn.hemoglobina3,
    pn.fecha_atencion3,
    pn.resultado,
    pn.avance,
    pn.fotos,
    pn.programacion1,
    pn.padronnominal,
    pn.iddistrito,
    pn.discapacidad,
    pn.titular_linea,
    pn.codigov,
    pn.img_carnet,
    pn.estado_verificacion,
    pn.estado,
    pn.estado_verificado,
    pn.celularseapp,
    pn.tipodispositivo,
    pn.estadointervencion,
    pn.asignacion,
    pn.estadoseguro,
    pn.fecha_act_seguro,
    pn.nombre_comercial,
    pn.hbregistro,
    pn.ccred,
    ROW_NUMBER() OVER (
      PARTITION BY pn.ubigeo, pn.etapa, pn.idpn
      ORDER BY pn.fechamodificacion DESC, pn.idpn DESC
    ) AS rn_pn
  FROM padronnominal pn
  WHERE {" AND ".join(where)}
),
vr0 AS (
  SELECT vr.ubigeo, vr.etapa, vr.dni, vr.tamisaje, vr.hb, vr.anemia, vr.hierro, vr.tsf, vr.rsf, vr.visitadops, vr.sesiondem, vr.tieneps,
         vr.fecha_atencion1, vr.hemoglobina1, vr.fecha_atencion2, vr.hemoglobina2, vr.fecha_atencion3, vr.hemoglobina3,
         vr.tiposeguro, vr.tipodocum, vr.estadoseguro, vr.fecha_act_seguro, vr.titular_linea, vr.celularseapp,
         vr.tam_fecha_atencion, vr.tam_hemoglobina, vr.tam_peso, vr.tam_talla, vr.tam_cie_10, vr.tam_resultado,
         ROW_NUMBER() OVER (
           PARTITION BY vr.ubigeo, vr.etapa, TRIM(vr.dni)
           ORDER BY vr.idverificacion DESC
         ) AS rn_ver
  FROM verificacion vr
  WHERE vr.etapa IN ({','.join(['%s'] * len(etapas))})
  {vr_ubigeo_sql}
),
pn AS (
  SELECT
    pn0.*,
    COALESCE(NULLIF(UPPER(TRIM(pn0.nombres)),'NULL'), pdr_cnv.nino_nombres, pdr_dni.nino_nombres, pdr_cod.nino_nombres, pn0.nombres) AS nombres_final,
    COALESCE(NULLIF(UPPER(TRIM(pn0.appatmadre)),'NULL'), pdr_cnv.madre_appat, pdr_dni.madre_appat, pdr_cod.madre_appat, pn0.appatmadre) AS appatmadre_final,
    COALESCE(NULLIF(UPPER(TRIM(pn0.apmatmadre)),'NULL'), pdr_cnv.madre_apmat, pdr_dni.madre_apmat, pdr_cod.madre_apmat, pn0.apmatmadre) AS apmatmadre_final,
    COALESCE(NULLIF(UPPER(TRIM(pn0.nombresmadre)),'NULL'), pdr_cnv.madre_nombres, pdr_dni.madre_nombres, pdr_cod.madre_nombres, pn0.nombresmadre) AS nombresmadre_final,
    COALESCE(NULLIF(UPPER(TRIM(pn0.telefonopn)),'NULL'), pdr_cnv.madre_celular, pdr_dni.madre_celular, pdr_cod.madre_celular, pn0.telefonopn) AS telefonopn_final,
    COALESCE(NULLIF(UPPER(TRIM(pn0.dni_padre)),'NULL'), pdr_cnv.padre_dni, pdr_dni.padre_dni, pdr_cod.padre_dni, pn0.dni_padre) AS dni_padre_final,
    TRIM(CONCAT_WS(' ', pdr_cnv.padre_appat, pdr_cnv.padre_apmat, pdr_cnv.padre_nombres)) AS padre_nombre_cnv,
    TRIM(CONCAT_WS(' ', pdr_dni.padre_appat, pdr_dni.padre_apmat, pdr_dni.padre_nombres)) AS padre_nombre_dni,
    TRIM(CONCAT_WS(' ', pdr_cod.padre_appat, pdr_cod.padre_apmat, pdr_cod.padre_nombres)) AS padre_nombre_cod
  FROM pn0
  LEFT JOIN pdj ON pdj.ubigeo = pn0.ubigeo AND pdj.periodo = pn0.etapa
  LEFT JOIN pdr_cnv ON pdr_cnv.job_id = pdj.job_id AND pdr_cnv.cnv_key = TRIM(pn0.dni)
  LEFT JOIN pdr_dni ON pdr_dni.job_id = pdj.job_id AND pdr_dni.dni_key = TRIM(pn0.dni)
  LEFT JOIN pdr_cod ON pdr_cod.job_id = pdj.job_id AND pdr_cod.codpad_key = TRIM(pn0.dni)
  WHERE pn0.rn_pn = 1
),
p_actor AS (
  SELECT dni, nombrecompleto, apellidos
  FROM (
    SELECT TRIM(p.dni) AS dni, p.nombrecompleto, p.apellidos,
           ROW_NUMBER() OVER (PARTITION BY TRIM(p.dni) ORDER BY p.idpersona DESC) AS rn_persona
    FROM persona p
    WHERE TRIM(COALESCE(p.dni,'')) <> ''
  ) x
  WHERE rn_persona = 1
),
p_resp AS (
  SELECT dni, nombrecompleto, apellidos
  FROM (
    SELECT TRIM(p.dni) AS dni, p.nombrecompleto, p.apellidos,
           ROW_NUMBER() OVER (PARTITION BY TRIM(p.dni) ORDER BY p.idpersona DESC) AS rn_persona
    FROM persona p
    WHERE TRIM(COALESCE(p.dni,'')) <> ''
  ) x
  WHERE rn_persona = 1
)
SELECT
  pn.idpn, pn.tipo, pn.rango, pn.ccpp, pn.zona, pn.mz, pn.direccion, pn.referencia, pn.codeess, pn.tipodoc, pn.dni,
  pn.nombres_final AS nombres,
  pn.fecha_nac,
  pn.dnimadre,
  pn.appatmadre_final AS appatmadre,
  pn.apmatmadre_final AS apmatmadre,
  pn.nombresmadre_final AS nombresmadre,
  pn.dni_padre_final AS dni_padre,
  COALESCE(NULLIF(UPPER(TRIM(pn.nombre_padre)),'NULL'), NULLIF(pn.padre_nombre_cnv,''), NULLIF(pn.padre_nombre_dni,''), NULLIF(pn.padre_nombre_cod,''), pn.nombre_padre) AS nombre_padre,
  pn.idocurrencia, pn.idocurrencia2, pn.nuevadireccion, pn.nuevareferencia, pn.observacion, pn.obspadron,
  pn.actorsocial, pn.responsable, pn.telefono, pn.telefonopn_final AS telefonopn, pn.adulto, pn.cantidada, pn.etapa, pn.estadovd, pn.fechacita, pn.nrovd,
  pn.eess_ua, pn.departamento, pn.provincia, pn.distrito, pn.codqr, pn.modovd, pn.tipovd, pn.lat, pn.lon, pn.lat2, pn.long2, pn.lat3, pn.long3,
  pn.fechamodificacion, pn.fechamodificacion2,
  vr0.tamisaje, vr0.hb, vr0.anemia, vr0.hierro, vr0.tsf, vr0.rsf, vr0.visitadops, vr0.sesiondem, vr0.tieneps,
  pn.observacion2, pn.fechatamisaje, vr0.tiposeguro, vr0.tipodocum, pn.usuario, pn.ubigeo, pn.fecha_inicio_vd, pn.fecha_fin_vd,
  pn.estadosvd, pn.estadosvd2, pn.estadosvd3, pn.primera_vd, pn.segunda_vd, pn.tercera_vd,
  vr0.tam_fecha_atencion, vr0.tam_hemoglobina, vr0.tam_peso, vr0.tam_talla, vr0.tam_cie_10, vr0.tam_resultado,
  vr0.hemoglobina1, vr0.fecha_atencion1, vr0.hemoglobina2, vr0.fecha_atencion2, vr0.hemoglobina3, vr0.fecha_atencion3,
  pn.resultado, pn.avance, pn.fotos, pn.programacion1, pn.padronnominal, pn.iddistrito, pn.discapacidad, vr0.titular_linea, pn.codigov, pn.img_carnet,
  pn.estado_verificacion, pn.estado, pn.estado_verificado, vr0.celularseapp, pn.tipodispositivo, pn.estadointervencion, pn.asignacion, vr0.estadoseguro, vr0.fecha_act_seguro,
  pn.nombre_comercial, pn.hbregistro, pn.ccred,
  p_actor.nombrecompleto AS actor_nombre,
  p_resp.nombrecompleto AS responsable_nombre,
  o1.descripcion AS ocurrencia_desc,
  o2.descripcion AS ocurrencia2_desc
FROM pn
LEFT JOIN vr0 ON vr0.rn_ver = 1 AND vr0.etapa = pn.etapa AND TRIM(vr0.dni) = TRIM(pn.dni)
LEFT JOIN p_actor ON p_actor.dni = TRIM(pn.actorsocial)
LEFT JOIN p_resp ON p_resp.dni = TRIM(pn.responsable)
LEFT JOIN ocurrencias o1 ON o1.idocurrencias = pn.idocurrencia
LEFT JOIN ocurrencias o2 ON o2.idocurrencias = pn.idocurrencia2
ORDER BY pn.ubigeo ASC, pn.etapa DESC, pn.idpn ASC
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
