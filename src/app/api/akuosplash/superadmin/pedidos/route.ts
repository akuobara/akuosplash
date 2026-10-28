import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/superadmin/pedidos
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const pedidos = await akuosplashDb.akuoPedidoCliente.findMany({
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true, email: true } },
      transportista: { select: { id: true, nombre: true } },
    },
    take: 100,
  });

  return NextResponse.json({ pedidos });
}
