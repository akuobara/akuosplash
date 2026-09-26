// Cliente Prisma para Bolsón.
// Usa el mismo Turso de Aljibe (tablas prefijadas "Bolson*" = aislamiento lógico).
// En dev usa un archivo SQLite local separado en db/bolson.db.
import { PrismaClient } from "../generated/bolson-client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForBolson = globalThis as unknown as { bolsonDb?: PrismaClient };

function createBolsonClient() {
  const url = process.env.BOLSON_DATABASE_URL || process.env.DATABASE_URL!;
  const isTurso = url.startsWith("libsql://");
  const authToken = isTurso
    ? process.env.BOLSON_DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
    : undefined;
  const adapter = new PrismaLibSQL({ url, authToken });
  return new PrismaClient({ adapter });
}

export const bolsonDb =
  globalForBolson.bolsonDb ??
  createBolsonClient();

if (process.env.NODE_ENV !== "production") {
  globalForBolson.bolsonDb = bolsonDb;
}
