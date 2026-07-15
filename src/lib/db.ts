import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getDb() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  
  if (!url) throw new Error('DATABASE_URL not set')
  
  const libsql = createClient({ url, authToken })
  const adapter = new PrismaLibSql(libsql)
  const client = new PrismaClient({ adapter, log: ['error'] })
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

// Exportar como db para compatibilidad
export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getDb() as any)[prop]
  }
})
