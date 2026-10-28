import { PrismaClient } from "@/generated/akuosplash-client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForAkuo = globalThis as unknown as { akuoDb?: PrismaClient };

function createAkuoClient() {
  // Fallback para build time: cuando DATABASE_URL no está seteada (ej: durante `next build`)
  // usamos un dummy SQLite file URL para que PrismaLibSQL no crashee.
  // En runtime (cuando los API routes se llaman), las env vars SÍ están seteadas.
  const url = process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "file:///tmp/akuosplash-build-only.db";
  const isTurso = url.startsWith("libsql://");
  const authToken = isTurso ? process.env.DATABASE_AUTH_TOKEN : undefined;
  const adapter = new PrismaLibSQL({ url, authToken });
  return new PrismaClient({ adapter });
}

export const akuosplashDb = globalForAkuo.akuoDb ?? createAkuoClient();

if (process.env.NODE_ENV !== "production") {
  globalForAkuo.akuoDb = akuosplashDb;
}
