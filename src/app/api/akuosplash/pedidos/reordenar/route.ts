import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/pedidos/reordenar — reordenar pedidos
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const body = await req.json();
  if (!Array.isArray(body.orden)) return NextResponse.json({ error: "Se esperaba array de IDs" }, { status: 400 });
  // Actualizar orden de cada pedido
  for (let i = 0; i < body.orden.length; i++) {
    await akuosplashDb.akuoPedido.update({
      where: { id: body.orden[i] },
      data: { orden: i } as any,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
