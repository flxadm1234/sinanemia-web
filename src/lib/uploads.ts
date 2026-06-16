import os from "os";
import path from "path";

export function getUploadsRootDir() {
  const configured = String(process.env.SINANEMIA_UPLOADS_DIR ?? "").trim();
  if (configured) return configured;
  try {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "sinanemia_uploads");
  } catch {
    return path.join(os.tmpdir(), "sinanemia_uploads");
  }
}

export function getUploadsDir(...parts: string[]) {
  return path.join(getUploadsRootDir(), ...parts);
}
