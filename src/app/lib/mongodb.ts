import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_URI_FALLBACK = process.env.MONGODB_URI_FALLBACK as string | undefined;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI in .env.local");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// @ts-expect-error -- global mongoose cache is used to avoid multiple connections in dev
let cached: MongooseCache = global.mongoose;

if (!cached) {
  // @ts-expect-error -- global mongoose cache is used to avoid multiple connections in dev
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const connect = async (uri: string) =>
      mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });

    cached.promise = connect(MONGODB_URI).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const isSrvError = message.includes("querySrv");

      if (isSrvError && MONGODB_URI_FALLBACK) {
        return connect(MONGODB_URI_FALLBACK);
      }

      throw error;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
