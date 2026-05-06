import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const COOKIE_NAME = "pv_auth";

async function isAuthed(request: NextRequest): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Node-RED / scripts: secret header only, no browser session
  if (pathname.startsWith("/api/events")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout") ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (!(await isAuthed(request))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
