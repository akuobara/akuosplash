import { createClient } from '@libsql/client';

export async function GET() {
  try {
    const url = process.env.DATABASE_URL!;
    const authToken = process.env.DATABASE_AUTH_TOKEN!;
    
    const client = createClient({ url, authToken });
    const result = await client.execute("SELECT COUNT(*) as count FROM Usuario");
    
    return Response.json({ 
      ok: true, 
      url: url.substring(0, 30) + "...",
      usuarios: result.rows[0].count 
    });
  } catch (e) {
    return Response.json({ 
      ok: false, 
      error: e instanceof Error ? e.message : String(e),
      url: process.env.DATABASE_URL?.substring(0, 30)
    });
  }
}
