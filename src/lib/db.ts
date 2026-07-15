import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  
  if (!url) throw new Error('DATABASE_URL not set')
  
  const libsql = createClient({ url, authToken })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter })
}

try {
  globalForPrisma.prisma ??= createPrismaClient()
} catch (e) {
  console.error('[db.ts] Error:', e)
}

export const db = globalForPrisma.prisma as PrismaClient
