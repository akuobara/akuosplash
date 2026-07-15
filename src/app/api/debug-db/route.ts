import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

export async function GET() {
  try {
    const url = process.env.DATABASE_URL
    const authToken = process.env.DATABASE_AUTH_TOKEN
    
    if (!url || !authToken) {
      return Response.json({ ok: false, error: 'Missing env vars', url: !!url, authToken: !!authToken })
    }
    
    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSQL(libsql)
    const prisma = new PrismaClient({ adapter })
    
    const count = await prisma.usuario.count()
    await prisma.$disconnect()
    
    return Response.json({ ok: true, usuarios: count })
  } catch (e) {
    return Response.json({ 
      ok: false, 
      error: e instanceof Error ? e.message : String(e) 
    }, { status: 500 })
  }
}
