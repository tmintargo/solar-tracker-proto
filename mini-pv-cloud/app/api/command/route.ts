import { NextResponse } from "next/server";
import { tunnelBase } from "@/lib/tunnel";

export async function POST(req: Request) {
  const base = tunnelBase();
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "COMMAND_TUNNEL_URL is not set on Vercel (Cloudflare tunnel base URL, no trailing slash)",
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const url = `${base}/mqtt/cmd`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    const text = await r.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* keep string */
    }

    return NextResponse.json(
      { ok: r.ok, status: r.status, upstream: parsed },
      { status: r.ok ? 200 : 502 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "tunnel request failed (is cloudflared running on the Pi?)" },
      { status: 502 }
    );
  }
}
