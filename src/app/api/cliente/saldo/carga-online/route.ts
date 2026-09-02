import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";
import { crearPreferenciaCargaSaldo } from "@/lib/mercadopago";

// POST /api/cliente/saldo/carga-online
// Crea una preferencia de pago en MercadoPago para cargar saldo
export async function POST(req: NextRequest) {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const monto = Number(body.monto);

    if (!monto || monto < 1000) {
      return NextResponse.json({ error: "El monto mínimo es $1.000" }, { status: 400 });
    }

    const cliente = await db.clienteApp.findUnique({
      where: { id: session.clienteId },
      select: { id: true, nombre: true, email: true, saldo: true },
    });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // Crear movimiento pendiente
    const movimiento = await db.movimientoSaldoClienteApp.create({
      data: {
        clienteId: cliente.id,
        tipo: "carga",
        monto,
        saldoResultante: cliente.saldo, // no cambia hasta confirmar
        descripcion: "Carga por MercadoPago (pendiente)",
        metodoCarga: "mercadopago",
        confirmado: false,
      },
    });

    // Crear preferencia en MercadoPago
    const pref = await crearPreferenciaCargaSaldo({
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      email: cliente.email,
      monto,
      movimientoId: movimiento.id,
    });

    return NextResponse.json({
      preferenceId: pref.preferenceId,
      initPoint: pref.initPoint,
      sandboxInitPoint: pref.sandboxInitPoint,
      movimientoId: movimiento.id,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear el pago" },
      { status: 500 }
    );
  }
}
