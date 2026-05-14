import { NextResponse } from "next/server";

const cookieName = "sinanemia_session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/login";
  url.search = "";

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

