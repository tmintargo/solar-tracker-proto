import { NextResponse } from "next/server";
import { maybeLogTelemetrySnapshot } from "@/lib/mongo-event-log";
import { tunnelBase } from "@/lib/tunnel";

export async function GET(req: Request) {
  const base = tunnelBase();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "COMMAND_TUNNEL_URL not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");
  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: "device_id query required" },
      { status: 400 }
    );
  }

  const url = `${base}/api/device/status?device_id=${encodeURIComponent(deviceId)}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);

    const text = await r.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    await maybeLogTelemetrySnapshot({
      device_id: deviceId,
      tunnel_http_ok: r.ok,
      snapshot: parsed,
    });

    return NextResponse.json(parsed, { status: r.ok ? 200 : 502 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "tunnel status fetch failed" },
      { status: 502 }
    );
  }
}
