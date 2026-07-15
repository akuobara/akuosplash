import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

export async function GET() {
  try {
    const url = process.env.DATABASE_URL!
    const authToken = process.env.DATABASE_AUTH_TOKEN!
    
    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSQL(libsql)
    const prisma = new PrismaClient({ adapter })
    
    const count = await prisma.usuario.count()
    await prisma.$disconnect()
    
    return Response.json({ ok: true, usuarios: count })
  } catch (e) {
    return Response.json({ 
      ok: false, 
      error: e instanceof Error ? e.message : String(e),
      url: process.env.DATABASE_URL?.substring(0, 30),
      hasUrl: !!process.env.DATABASE_URL,
      hasToken: !!process.env.DATABASE_AUTH_TOKEN,
    })
  }
}
