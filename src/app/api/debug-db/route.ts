import { db } from "@/lib/db";

export async function GET() {
  try {
    const count = await db.usuario.count();
    return Response.json({ ok: true, usuarios: count });
  } catch (e) {
    return Response.json({ 
      ok: false, 
      error: e instanceof Error ? e.message : String(e) 
    }, { status: 500 });
  }
}
