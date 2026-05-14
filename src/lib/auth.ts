import { env } from "@/lib/env";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SessionUser = {
  dni: string;
  tipo: "SUPER ADMIN" | "ADMINISTRADOR" | "COORDINADOR" | "ACTOR SOCIAL";
  ubigeo: number | null;
  nombre: string;
};

const cookieName = "sinanemia_session";

function getJwtSecret() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({
    dni: user.dni,
    tipo: user.tipo,
    ubigeo: user.ubigeo,
    nombre: user.nombre,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());

  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(cookieName);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const value = jar.get(cookieName)?.value;
  if (!value) return null;

  try {
    const { payload } = await jwtVerify(value, getJwtSecret());
    const dni = String(payload.dni ?? "");
    const tipo = String(payload.tipo ?? "");
    const nombre = String(payload.nombre ?? "");
    const ubigeoRaw = payload.ubigeo;
    const ubigeo =
      typeof ubigeoRaw === "number"
        ? ubigeoRaw
        : typeof ubigeoRaw === "string" && ubigeoRaw.trim()
          ? Number(ubigeoRaw)
          : null;

    if (!dni || !nombre) return null;
    if (
      tipo !== "SUPER ADMIN" &&
      tipo !== "ADMINISTRADOR" &&
      tipo !== "COORDINADOR" &&
      tipo !== "ACTOR SOCIAL"
    ) {
      return null;
    }

    return { dni, tipo, ubigeo: Number.isFinite(ubigeo) ? ubigeo : null, nombre };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.tipo !== "ADMINISTRADOR") redirect(routeForRole(s.tipo));
  return s;
}

export async function requireAdminOrSuperAdmin() {
  const s = await requireSession();
  if (s.tipo !== "ADMINISTRADOR" && s.tipo !== "SUPER ADMIN")
    redirect(routeForRole(s.tipo));
  return s;
}

export async function requireAdminOrCoordinador() {
  const s = await requireSession();
  if (s.tipo !== "ADMINISTRADOR" && s.tipo !== "COORDINADOR")
    redirect(routeForRole(s.tipo));
  return s;
}

export async function requireSuperAdmin() {
  const s = await requireSession();
  if (s.tipo !== "SUPER ADMIN") redirect(routeForRole(s.tipo));
  return s;
}

export async function requireCoordinador() {
  const s = await requireSession();
  if (s.tipo !== "COORDINADOR") redirect(routeForRole(s.tipo));
  return s;
}

export function routeForRole(tipo: SessionUser["tipo"]) {
  if (tipo === "SUPER ADMIN") return "/admin/personas";
  if (tipo === "ADMINISTRADOR") return "/admin/personas";
  if (tipo === "COORDINADOR") return "/coordinador/actores";
  return "/actor";
}

