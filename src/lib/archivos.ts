import { getDbPool } from "@/lib/db";
import { getUploadsDir } from "@/lib/uploads";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export type ArchivoUpload = {
  id: number;
  original_name: string;
  stored_name: string;
  ext: string | null;
  mime_type: string | null;
  size_bytes: number;
  title: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export function getArchivosUploadDir() {
  return getUploadsDir("archivos");
}

export async function ensureArchivosTables() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS archivos_uploads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      ext VARCHAR(20) NULL,
      mime_type VARCHAR(120) NULL,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      title VARCHAR(255) NULL,
      uploaded_by VARCHAR(15) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_stored_name (stored_name),
      KEY idx_created_at (created_at),
      KEY idx_original_name (original_name)
    ) ENGINE=InnoDB
  `);
}

export function makeStoredFileName(originalName: string) {
  const ext = path.extname(originalName || "").toLowerCase();
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { storedName: `${id}${ext}`, ext: ext ? ext.slice(1) : null };
}

export async function saveArchivoToDisk(params: { file: File; storedName: string }) {
  const dir = getArchivosUploadDir();
  await fs.mkdir(dir, { recursive: true });
  const buf = Buffer.from(await params.file.arrayBuffer());
  const fullPath = path.join(dir, params.storedName);
  await fs.writeFile(fullPath, buf);
  return { fullPath, sizeBytes: buf.length };
}

export async function createArchivoUpload(params: {
  originalName: string;
  storedName: string;
  ext: string | null;
  mimeType: string | null;
  sizeBytes: number;
  title: string | null;
  uploadedBy: string | null;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    `INSERT INTO archivos_uploads (original_name, stored_name, ext, mime_type, size_bytes, title, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.originalName,
      params.storedName,
      params.ext,
      params.mimeType,
      params.sizeBytes,
      params.title,
      params.uploadedBy,
    ],
  );
  const id = Number((res as any)?.insertId ?? 0);
  return getArchivoUploadById(id);
}

export async function getArchivoUploadById(id: number): Promise<ArchivoUpload | null> {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM archivos_uploads WHERE id = ? LIMIT 1", [id]);
  return ((rows as any[])[0] as ArchivoUpload | undefined) ?? null;
}

export async function listArchivosUploads(params: { q?: string | null; limit: number; offset: number }) {
  const pool = getDbPool();
  const q = String(params.q ?? "").trim();
  const where = q ? "WHERE original_name LIKE ? OR title LIKE ?" : "";
  const args = q ? [`%${q}%`, `%${q}%`] : [];

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM archivos_uploads ${where}`, args);
  const total = Number((countRows as any[])[0]?.total ?? 0);

  const [rows] = await pool.query(
    `SELECT * FROM archivos_uploads
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...args, params.limit, params.offset],
  );
  return { total, rows: rows as ArchivoUpload[] };
}

export async function updateArchivoUpload(params: { id: number; title: string | null }) {
  const pool = getDbPool();
  await pool.query("UPDATE archivos_uploads SET title = ? WHERE id = ?", [params.title, params.id]);
  return getArchivoUploadById(params.id);
}

export async function deleteArchivoUpload(params: { id: number }) {
  const pool = getDbPool();
  const current = await getArchivoUploadById(params.id);
  if (!current) return { ok: false as const, deleted: false as const };

  await pool.query("DELETE FROM archivos_uploads WHERE id = ?", [params.id]);
  const dir = getArchivosUploadDir();
  const filePath = path.join(dir, current.stored_name);
  try {
    await fs.unlink(filePath);
  } catch {}

  return { ok: true as const, deleted: true as const };
}
