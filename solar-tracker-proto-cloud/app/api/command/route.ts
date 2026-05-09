import { NextResponse } from "next/server";
import { logCommandEvent } from "@/lib/mongo-event-log";
import { tunnelBase } from "@/lib/tunnel";

function pickDeviceId(body: unknown): string {
  if (body && typeof body === "object" && "device_id" in body) {
    const v = (body as { device_id?: unknown }).device_id;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "(unknown)";
}

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

    await logCommandEvent({
      device_id: pickDeviceId(body),
      request_body: body,
      tunnel_http_status: r.status,
      tunnel_ok: r.ok,
      upstream: parsed,
    });

    return NextResponse.json(
      { ok: r.ok, status: r.status, upstream: parsed },
      { status: r.ok ? 200 : 502 }
    );
  } catch (e) {
    console.error(e);
    await logCommandEvent({
      device_id: pickDeviceId(body),
      request_body: body,
      tunnel_http_status: 0,
      tunnel_ok: false,
      upstream: { error: String(e) },
    });
    return NextResponse.json(
      { ok: false, error: "tunnel request failed (is cloudflared running on the Pi?)" },
      { status: 502 }
    );
  }
}
