import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const cookieName = "sinanemia_session";

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET ?? "";
  return new TextEncoder().encode(secret);
}

async function hasValidSession(req: NextRequest) {
  const token = req.cookies.get(cookieName)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) return false;

  try {
    await jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/registro")
  ) {
    return NextResponse.next();
  }

  const ok = await hasValidSession(req);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};

