import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

export async function GET() {
  try {
    const url = process.env.DATABASE_URL
    const authToken = process.env.DATABASE_AUTH_TOKEN
    
    // Log detallado
    console.log('URL:', url)
    console.log('TOKEN length:', authToken?.length)
    
    const libsql = createClient({ url: url!, authToken })
    const adapter = new PrismaLibSQL(libsql)
    const prisma = new PrismaClient({ adapter })
    
    const count = await prisma.usuario.count()
    await prisma.$disconnect()
    
    return Response.json({ ok: true, usuarios: count, urlUsed: url?.substring(0, 40) })
  } catch (e) {
    const err = e as any
    return Response.json({ 
      ok: false, 
      error: err.message,
      stack: err.stack?.substring(0, 500),
      url: process.env.DATABASE_URL,
      token: process.env.DATABASE_AUTH_TOKEN ? 'SET' : 'NOT SET',
    }, { status: 500 })
  }
}
