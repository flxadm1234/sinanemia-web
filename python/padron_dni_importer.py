import argparse
import json
import os
import re
import time
from datetime import date, datetime

import mysql.connector
from dotenv import load_dotenv
from openpyxl import load_workbook


def log_line(msg: str):
    p = os.getenv("PADRON_DNI_LOG_PATH", "").strip()
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


def to_text(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def normalize_dni(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        s = str(v)
    elif isinstance(v, float):
        if v != v:
            return None
        s = str(int(v)) if float(int(v)) == float(v) else str(v)
    else:
        s = str(v).strip()
    if not s:
        return None
    s = re.sub(r"[^\d]+", "", s)
    return s if s else None


def to_int(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, int):
        return int(v)
    if isinstance(v, float):
        if v != v:
            return None
        return int(v)
    s = str(v).strip()
    if not s:
        return None
    s = re.sub(r"[^\d]+", "", s)
    if not s:
        return None
    try:
        return int(s)
    except Exception:
        return None


def to_iso_date(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return None


def normalize_header(v):
    s = str(v or "").strip().upper()
    if not s:
        return ""
    s = s.replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U").replace("Ñ", "N")
    s = re.sub(r"[^A-Z0-9]+", "", s)
    return s


def find_header_row(ws):
    max_scan = min(40, ws.max_row or 0)
    for i in range(1, max_scan + 1):
        vals = []
        for c in ws[i]:
            t = normalize_header(c.value)
            if t:
                vals.append(t)
        s = set(vals)
        has_ubigeo = any(("UBIGEO" in v) for v in s)
        has_dni = any(("DNI" in v) for v in s) or ("NUMERODEDOCUMENTONACIONALDEIDENTIFICACIONDNI" in s)
        if has_ubigeo and has_dni:
            return i
    return None


def find_col(headers, candidates):
    for idx, h in enumerate(headers):
        if not h:
            continue
        for c in candidates:
            if h == c or h.startswith(c) or c in h:
                return idx
    return None


def best_ubigeo_col(ws, header_row, ubigeo_cols):
    if not ubigeo_cols:
        return None
    max_row = ws.max_row or 0
    data_start = header_row + 1
    scan_end = min(max_row, data_start + 250)
    best = None
    best_score = -1
    for idx in ubigeo_cols:
        score = 0
        for r in range(data_start, scan_end + 1):
            v = ws.cell(row=r, column=idx + 1).value
            u = to_int(v)
            if u and u > 0:
                score += 1
        if score > best_score:
            best_score = score
            best = idx
    return best


def sheet_headers(ws, header_row):
    headers = []
    for c in ws[header_row]:
        raw = str(c.value or "").strip()
        headers.append(raw)
    return headers


def period_from_fecha_corte(fecha_corte: date):
    return date(fecha_corte.year, fecha_corte.month, 1)


def job_update(cur, job_id: str, **fields):
    if not fields:
        return
    set_parts = []
    vals = []
    for k, v in fields.items():
        set_parts.append(f"{k}=%s")
        vals.append(v)
    sql = "UPDATE padron_dni_import_jobs SET " + ", ".join(set_parts) + " WHERE id=%s"
    vals.append(job_id)
    cur.execute(sql, vals)


RAW_INSERT_SQL = """
INSERT INTO padron_dni_raw
  (job_id, tipo, row_num, ubigeo, dni, payload)
VALUES
  (%s,%s,%s,%s,%s,%s)
"""


def validate_fecha_corte_rules(cur, job_id: str, ubigeo: int, periodo: date, fecha_corte: date):
    cur.execute(
        """
        SELECT id, fecha_corte
        FROM padron_dni_import_jobs
        WHERE ubigeo = %s
          AND periodo = %s
          AND status IN ('queued','running','done')
          AND id <> %s
        """,
        [ubigeo, periodo, job_id],
    )
    rows = cur.fetchall() or []
    cortes = []
    for r in rows:
        fc = r[1]
        if isinstance(fc, datetime):
            fc = fc.date()
        if isinstance(fc, date):
            cortes.append(fc)
    if len(cortes) >= 2:
        return False, "Ya existen 2 fechas de corte registradas para este ubigeo y mes. Debes eliminar una para volver a cargar."

    inicio = periodo
    if fecha_corte == inicio:
        for fc in cortes:
            if fc == inicio:
                return False, "Ya existe una carga para INICIO DE MES (día 01) en este ubigeo y mes. Debes eliminarla para volver a cargar."
        return True, ""

    for fc in cortes:
        if fc != inicio:
            return False, "Ya existe una carga para AVANCE (segunda fecha de corte) en este ubigeo y mes. Debes eliminarla para volver a cargar."

    return True, ""


def extract_rows(ws, tipo: str):
    header_row = find_header_row(ws)
    if not header_row:
        raise Exception("No se encontró la fila de encabezados (CODIGO UBIGEO / DNI). Revisa la plantilla.")

    headers = sheet_headers(ws, header_row)
    headers_norm = [normalize_header(h) for h in headers]
    ubigeo_cols = [i for i, h in enumerate(headers_norm) if h and ("UBIGEO" in h)]
    col_ubigeo = best_ubigeo_col(ws, header_row, ubigeo_cols)
    col_dni = find_col(headers_norm, ["NUMERODEDOCUMENTONACIONALDEIDENTIFICACIONDNI", "DNI"])
    if col_ubigeo is None:
        raise Exception("No se encontró la columna de UBIGEO en la plantilla.")

    ubigeos = set()
    data_start = header_row + 1
    empty_run = 0
    out = []

    max_col = ws.max_column or 1
    max_row = ws.max_row or data_start

    for r in range(data_start, max_row + 1):
        row_vals = [ws.cell(row=r, column=c).value for c in range(1, max_col + 1)]

        u = to_int(row_vals[col_ubigeo] if col_ubigeo is not None else None)
        if u and u > 0:
            ubigeos.add(int(u))

        dni = None
        if col_dni is not None:
            dni = normalize_dni(row_vals[col_dni])

        has_any = False
        for v in row_vals[: min(max_col, 12)]:
            if v is None:
                continue
            s = str(v).strip()
            if s:
                has_any = True
                break
        if not has_any and not dni and not u:
            empty_run += 1
            if empty_run >= 30:
                break
            continue
        empty_run = 0

        payload = []
        for v in row_vals:
            d = to_iso_date(v)
            if d:
                payload.append(d)
            else:
                payload.append(v if v is not None else "")

        out.append((r, int(u) if u and u > 0 else None, dni, payload))

    if not ubigeos:
        raise Exception("No se pudo determinar el ubigeo desde el Excel.")

    if len(ubigeos) > 1:
        ubigeos_str = ",".join([str(x) for x in sorted(list(ubigeos))[:10]])
        raise Exception(f"Se detectaron múltiples ubigeos en el Excel ({ubigeos_str}).")

    ubigeo_final = int(list(ubigeos)[0])
    fixed = []
    for row_num, u, dni, payload in out:
        fixed.append((row_num, ubigeo_final, dni, payload))

    return ubigeo_final, headers, fixed


def run_import(job_id: str, activo_path: str, observado_path: str, transito_path: str, fecha_corte: date):
    load_dotenv(os.getenv("PADRON_DNI_DOTENV", ".env.local"), override=False)
    load_dotenv(override=False)

    db = connect_db()
    cur = db.cursor()

    job_update(cur, job_id, status="running", progress=0, started_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), message="Leyendo Excel...")
    db.commit()

    periodo = period_from_fecha_corte(fecha_corte)

    wb_a = load_workbook(filename=activo_path, read_only=True, data_only=True)
    wb_o = load_workbook(filename=observado_path, read_only=True, data_only=True)
    wb_t = load_workbook(filename=transito_path, read_only=True, data_only=True)
    ws_a = wb_a.worksheets[0]
    ws_o = wb_o.worksheets[0]
    ws_t = wb_t.worksheets[0]

    ub_a, headers, rows_a = extract_rows(ws_a, "ACTIVO")
    ub_o, headers_o, rows_o = extract_rows(ws_o, "ACTIVO_OBSERVADO")
    ub_t, headers_t, rows_t = extract_rows(ws_t, "TRANSITO")

    if ub_a != ub_o or ub_a != ub_t:
        raise Exception(f"Los 3 archivos no tienen el mismo ubigeo. Activo={ub_a} Observado={ub_o} Transito={ub_t}")

    if len(headers_o) != len(headers) or len(headers_t) != len(headers):
        raise Exception("Los 3 archivos no tienen la misma plantilla (número de columnas).")

    ok, msg = validate_fecha_corte_rules(cur, job_id, ub_a, periodo, fecha_corte)
    if not ok:
        raise Exception(msg)

    job_update(
        cur,
        job_id,
        ubigeo=ub_a,
        periodo=periodo,
        fecha_corte=fecha_corte,
        headers_json=json.dumps(headers, ensure_ascii=False),
        total_rows=(len(rows_a) + len(rows_o) + len(rows_t)),
        processed_rows=0,
        inserted_rows=0,
        message="Insertando registros...",
    )
    db.commit()

    batch_size = 400
    inserted_total = 0
    processed_total = 0
    total_rows = len(rows_a) + len(rows_o) + len(rows_t)
    last_tick = time.time()

    def insert_many(tipo: str, rows):
        nonlocal inserted_total, processed_total, last_tick
        for i in range(0, len(rows), batch_size):
            part = rows[i : i + batch_size]
            values = []
            for excel_row, ub, dni, payload in part:
                values.append(
                    (
                        job_id,
                        tipo,
                        int(excel_row),
                        int(ub) if ub else None,
                        dni,
                        json.dumps(payload, ensure_ascii=False),
                    )
                )
            if values:
                cur.executemany(RAW_INSERT_SQL, values)
                db.commit()
                inserted_total += cur.rowcount if cur.rowcount and cur.rowcount > 0 else len(values)
            processed_total += len(part)

            now = time.time()
            if now - last_tick >= 0.6 or processed_total >= total_rows:
                progress = int((processed_total / max(1, total_rows)) * 100)
                job_update(
                    cur,
                    job_id,
                    progress=progress,
                    processed_rows=processed_total,
                    inserted_rows=inserted_total,
                    message=f"Procesando... {processed_total}/{total_rows}",
                )
                db.commit()
                last_tick = now

    insert_many("ACTIVO", rows_a)
    insert_many("ACTIVO_OBSERVADO", rows_o)
    insert_many("TRANSITO", rows_t)

    job_update(
        cur,
        job_id,
        status="done",
        progress=100,
        processed_rows=processed_total,
        inserted_rows=inserted_total,
        finished_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        message=f"Completado. Insertados: {inserted_total}",
    )
    db.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True)
    ap.add_argument("--activo", required=True)
    ap.add_argument("--observado", required=True)
    ap.add_argument("--transito", required=True)
    ap.add_argument("--fecha_corte", required=True)
    args = ap.parse_args()

    try:
        fecha = datetime.strptime(args.fecha_corte.strip(), "%Y-%m-%d").date()
    except Exception:
        raise Exception("Fecha de corte inválida (YYYY-MM-DD).")

    try:
        run_import(args.job, args.activo, args.observado, args.transito, fecha)
    except Exception as e:
        try:
            load_dotenv(os.getenv("PADRON_DNI_DOTENV", ".env.local"), override=False)
            load_dotenv(override=False)
            db = connect_db()
            cur = db.cursor()
            job_update(
                cur,
                args.job,
                status="failed",
                progress=0,
                finished_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                message=str(e),
            )
            db.commit()
        except Exception:
            pass
        log_line(f"FAILED: {e}")
        raise


if __name__ == "__main__":
    main()
