import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Set MONGODB_URI in environment");
}

declare global {
  // eslint-disable-next-line no-var -- reuse across hot reload / serverless invocations
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const client = new MongoClient(uri);
  return client.connect();
}

/** Cached client — recommended for Next.js + Atlas on Vercel. */
const clientPromise =
  global._mongoClientPromise ?? (global._mongoClientPromise = connect());

export default clientPromise;
