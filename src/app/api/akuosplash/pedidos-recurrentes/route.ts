import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/pedidos-recurrentes — lista de pedidos recurrentes
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  // AkuoSplash no tiene modelo de pedidos recurrentes todavía
  // Devolver lista vacía para que el tab no crashee
  return NextResponse.json({ recurrentes: [] });
}

// POST /api/akuosplash/pedidos-recurrentes — crear pedido recurrente
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  // Por ahora, devolver OK sin crear (no hay modelo en AkuoSplash)
  return NextResponse.json({ ok: true, pedidoRecurrente: null }, { status: 201 });
}
