import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  
  console.log('[db.ts] Creating PrismaClient with URL:', url?.substring(0, 30))
  
  if (!url) throw new Error('DATABASE_URL not set')
  
  const libsql = createClient({ url, authToken })
  const adapter = new PrismaLibSql(libsql)
  return new PrismaClient({ adapter })
}

// Crear el cliente inmediatamente (las env vars SÍ están disponibles en runtime)
try {
  globalForPrisma.prisma ??= createPrismaClient()
} catch (e) {
  console.error('[db.ts] Error creating PrismaClient:', e)
}

export const db = globalForPrisma.prisma as PrismaClient
