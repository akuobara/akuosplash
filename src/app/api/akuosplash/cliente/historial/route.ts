import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const pedidos = await akuosplashDb.akuoPedidoCliente.findMany({
    where: { clienteId: user.id, estado: { in: ["entregado", "cancelado"] } },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({ historial: pedidos });
}
