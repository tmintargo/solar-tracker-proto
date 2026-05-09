import type { Db } from "mongodb";
import { getDb } from "@/lib/mongodb";

/** Auto-delete documents this many seconds after `createdAt` (MongoDB TTL index). Default = 1 day. */
function ttlSeconds(): number {
  const n = Number(process.env.MONGO_EVENT_TTL_SEC);
  return Number.isFinite(n) && n >= 60 ? Math.floor(n) : 86400;
}

/** Minimum gap between telemetry snapshots per device (UI polls every ~5s). Default 60s. */
function telemetryLogIntervalSec(): number {
  const n = Number(process.env.MONGO_LOG_TELEMETRY_INTERVAL_SEC);
  return Number.isFinite(n) && n >= 15 ? Math.floor(n) : 60;
}

let indexesEnsuredForDb = "";

async function ensureTTLIndexes(db: Db): Promise<void> {
  const id = db.databaseName;
  if (indexesEnsuredForDb === id) return;
  const ttl = ttlSeconds();

  await db.collection("stp_command_events").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: ttl }
  );
  await db.collection("stp_telemetry_snapshots").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: ttl }
  );

  indexesEnsuredForDb = id;
}

export async function logCommandEvent(input: {
  device_id: string;
  request_body: unknown;
  tunnel_http_status: number;
  tunnel_ok: boolean;
  upstream: unknown;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await ensureTTLIndexes(db);
    await db.collection("stp_command_events").insertOne({
      createdAt: new Date(),
      device_id: input.device_id,
      request_body: input.request_body,
      tunnel_http_status: input.tunnel_http_status,
      tunnel_ok: input.tunnel_ok,
      upstream: input.upstream,
    });
  } catch (e) {
    console.error("Mongo logCommandEvent:", e);
  }
}

export async function maybeLogTelemetrySnapshot(input: {
  device_id: string;
  tunnel_http_ok: boolean;
  snapshot: unknown;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await ensureTTLIndexes(db);

    const intervalMs = telemetryLogIntervalSec() * 1000;
    const throttle = db.collection<{ _id: string; lastLoggedAt: Date }>(
      "stp_telemetry_throttle"
    );
    const now = new Date();
    const id = input.device_id;

    const existing = await throttle.findOne({ _id: id });
    if (
      existing &&
      now.getTime() - existing.lastLoggedAt.getTime() < intervalMs
    ) {
      return;
    }

    await db.collection("stp_telemetry_snapshots").insertOne({
      createdAt: now,
      device_id: id,
      tunnel_http_ok: input.tunnel_http_ok,
      snapshot: input.snapshot,
    });

    await throttle.updateOne(
      { _id: id },
      { $set: { lastLoggedAt: now } },
      { upsert: true }
    );
  } catch (e) {
    console.error("Mongo maybeLogTelemetrySnapshot:", e);
  }
}
