import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

type Body = {
  device_id?: string;
  type?: string;
  payload?: unknown;
  source?: string;
};

export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (
    !process.env.INTERNAL_LOG_SECRET ||
    secret !== process.env.INTERNAL_LOG_SECRET
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";

  if (!deviceId || !type) {
    return NextResponse.json(
      { ok: false, error: "device_id and type required" },
      { status: 400 }
    );
  }

  const dbName = process.env.MONGODB_DB || "solarcart";

  try {
    const client = await clientPromise;
    const col = client.db(dbName).collection("events");
    const doc = {
      device_id: deviceId,
      type,
      payload: body.payload ?? null,
      source: typeof body.source === "string" ? body.source : "unknown",
      createdAt: new Date(),
    };
    const r = await col.insertOne(doc);
    return NextResponse.json({ ok: true, id: String(r.insertedId) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "db error" }, { status: 500 });
  }
}
