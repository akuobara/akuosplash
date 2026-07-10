import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/entregas/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const litros = body.litros != null ? Number(body.litros) : undefined;
  const precioPorLitro = body.precioPorLitro != null ? Number(body.precioPorLitro) : undefined;
  const montoRecibido = body.montoRecibido != null ? Number(body.montoRecibido) : undefined;

  // Recalcular total si cambió litros o precio
  let total: number | undefined;
  if (litros != null && precioPorLitro != null) {
    total = litros * precioPorLitro;
  }

  // Recalcular estado de pago si cambió montoRecibido o total
  let estadoPago: string | undefined;
  if (montoRecibido != null) {
    const totalFinal = total ?? (await db.entrega.findUnique({ where: { id } }))?.total ?? 0;
    if (montoRecibido >= totalFinal && totalFinal > 0) estadoPago = "pagado";
    else if (montoRecibido > 0) estadoPago = "parcial";
    else estadoPago = "pendiente";
  }

  const actualizada = await db.entrega.update({
    where: { id },
    data: {
      ...(body.fecha !== undefined && { fecha: new Date(body.fecha) }),
      ...(body.clienteNombre !== undefined && { clienteNombre: body.clienteNombre.trim() }),
      ...(body.clienteDireccion !== undefined && { clienteDireccion: body.clienteDireccion?.trim() || null }),
      ...(body.clienteTelefono !== undefined && { clienteTelefono: body.clienteTelefono?.trim() || null }),
      ...(body.clienteId !== undefined && { clienteId: body.clienteId || null }),
      ...(body.lecturaAnterior !== undefined && { lecturaAnterior: body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null }),
      ...(body.lecturaActual !== undefined && { lecturaActual: body.lecturaActual != null ? Number(body.lecturaActual) : null }),
      ...(litros !== undefined && { litros }),
      ...(precioPorLitro !== undefined && { precioPorLitro }),
      ...(total !== undefined && { total }),
      ...(montoRecibido !== undefined && { montoRecibido }),
      ...(estadoPago !== undefined && { estadoPago }),
      ...(body.estadoPago !== undefined && { estadoPago: body.estadoPago }),
      ...(body.fotoMedidorUrl !== undefined && { fotoMedidorUrl: body.fotoMedidorUrl || null }),
      ...(body.nota !== undefined && { nota: body.nota?.trim() || null }),
    },
  });

  return NextResponse.json({ entrega: actualizada });
}

// DELETE /api/entregas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.entrega.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
