import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!globalForPrisma.prisma) {
      const { PrismaLibSQL } = require('@prisma/adapter-libsql')
      const { createClient } = require('@libsql/client')
      const url = process.env.DATABASE_URL
      const authToken = process.env.DATABASE_AUTH_TOKEN
      const libsql = createClient({ url, authToken })
      const adapter = new PrismaLibSQL(libsql)
      globalForPrisma.prisma = new PrismaClient({ adapter })
    }
    return (globalForPrisma.prisma as any)[prop]
  }
})
