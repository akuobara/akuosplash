import { PrismaClient } from "@/generated/akuosplash-client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForAkuo = globalThis as unknown as { akuoDb?: PrismaClient };

function createAkuoClient() {
  const url = process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL!;
  const isTurso = url.startsWith("libsql://");
  const authToken = isTurso ? process.env.DATABASE_AUTH_TOKEN : undefined;
  const adapter = new PrismaLibSQL({ url, authToken });
  return new PrismaClient({ adapter });
}

export const akuosplashDb = globalForAkuo.akuoDb ?? createAkuoClient();

if (process.env.NODE_ENV !== "production") {
  globalForAkuo.akuoDb = akuosplashDb;
}
