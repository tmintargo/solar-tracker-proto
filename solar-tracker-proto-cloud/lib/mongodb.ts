import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var -- reuse across hot reload / serverless invocations
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function mongoUri(): string | null {
  const u = process.env.MONGODB_URI?.trim();
  return u || null;
}

/** Database name from env or default (matches Atlas app naming). */
export function mongoDbName(): string {
  return process.env.MONGODB_DB?.trim() || "solar_tracker_proto";
}

/**
 * Shared Mongo client for Next.js serverless (single cached promise).
 * Returns null if `MONGODB_URI` is unset — callers should skip DB work.
 */
export function getMongoClientPromise(): Promise<MongoClient> | null {
  const uri = mongoUri();
  if (!uri) return null;
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db | null> {
  const p = getMongoClientPromise();
  if (!p) return null;
  const client = await p;
  return client.db(mongoDbName());
}
