import { NextResponse } from "next/server";

const cookieName = "sinanemia_session";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  const base = host ? `${proto}://${host}` : request.url;
  const url = new URL("/login", base);

  const res = NextResponse.redirect(url);
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return res;
}

