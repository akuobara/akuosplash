import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-fix-secret");
  if (secret !== "aljibe-fix-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Buscar el pago de Rosa de hoy y cambiarlo a transferencia
  const pago = await db.pago.findFirst({
    where: {
      cliente: { nombre: { contains: "Rosa" } },
      metodoPago: "efectivo",
    },
    orderBy: { fecha: "desc" },
    include: { cliente: { select: { nombre: true } } },
  });

  if (!pago) {
    return NextResponse.json({ error: "No se encontró el pago de Rosa" }, { status: 404 });
  }

  // Cambiar a transferencia
  const actualizado = await db.pago.update({
    where: { id: pago.id },
    data: { metodoPago: "transferencia" },
  });

  return NextResponse.json({
    ok: true,
    antes: { id: pago.id, cliente: pago.cliente?.nombre, metodoPago: pago.metodoPago, monto: pago.monto },
    despues: { id: actualizado.id, metodoPago: actualizado.metodoPago },
  });
}
