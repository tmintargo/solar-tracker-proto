import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";

export async function POST(req: Request) {
  const secretStr = process.env.AUTH_SECRET?.trim();
  const sitePw = process.env.SITE_PASSWORD?.trim() ?? "";

  if (!secretStr || !sitePw) {
    return NextResponse.json(
      { ok: false, error: "SITE_PASSWORD and AUTH_SECRET must be set" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pw =
    typeof body.password === "string" ? body.password.trim() : "";
  if (pw !== sitePw) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const secret = new TextEncoder().encode(secretStr);
  const token = await new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);

  const secure =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
