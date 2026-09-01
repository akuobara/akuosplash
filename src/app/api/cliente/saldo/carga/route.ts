import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// POST /api/cliente/saldo/carga
// Cargar saldo: transferencia (con comprobante, requiere confirmación) o efectivo (auto)
export async function POST(req: NextRequest) {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const monto = Number(body.monto);
    const metodo = body.metodoCarga || "transferencia";

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    if (!["transferencia", "efectivo"].includes(metodo)) {
      return NextResponse.json({ error: "Método no válido" }, { status: 400 });
    }

    // Solo clientes con >= 10 entregas exitosas pueden pagar en efectivo
    if (metodo === "efectivo") {
      const cliente = await db.clienteApp.findUnique({
        where: { id: session.clienteId },
        select: { entregasExitosas: true },
      });
      if (!cliente || cliente.entregasExitosas < 10) {
        return NextResponse.json({
          error: "Para pagar en efectivo necesitás al menos 10 entregas exitosas. Por ahora solo transferencia.",
        }, { status: 403 });
      }
    }

    // Crear movimiento pendiente (no suma al saldo todavía, salvo efectivo)
    const clienteActual = await db.clienteApp.findUnique({
      where: { id: session.clienteId },
      select: { saldo: true },
    });
    if (!clienteActual) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const saldoAntes = clienteActual.saldo;
    const comprobanteUrl = body.comprobanteUrl || null;

    if (metodo === "efectivo") {
      // Efectivo: confirmación automática, suma al saldo de inmediato
      const saldoResultante = saldoAntes + monto;
      const movimiento = await db.movimientoSaldoClienteApp.create({
        data: {
          clienteId: session.clienteId,
          tipo: "carga",
          monto,
          saldoResultante,
          descripcion: "Carga de saldo en efectivo",
          metodoCarga: "efectivo",
          confirmado: true,
          confirmadoEn: new Date(),
        },
      });
      await db.clienteApp.update({
        where: { id: session.clienteId },
        data: { saldo: saldoResultante },
      });
      return NextResponse.json({ movimiento, nuevoSaldo: saldoResultante }, { status: 201 });
    }

    // Transferencia: requiere comprobante y confirmación manual del super admin
    if (!comprobanteUrl) {
      return NextResponse.json({
        error: "Para transferencia tenés que subir el comprobante",
      }, { status: 400 });
    }

    const movimiento = await db.movimientoSaldoClienteApp.create({
      data: {
        clienteId: session.clienteId,
        tipo: "carga",
        monto,
        saldoResultante: saldoAntes, // no cambia hasta confirmar
        descripcion: "Carga por transferencia (pendiente de confirmación)",
        metodoCarga: "transferencia",
        comprobanteUrl,
        confirmado: false,
      },
    });

    return NextResponse.json({
      movimiento,
      nuevoSaldo: saldoAntes, // sigue igual hasta que se confirme
      mensaje: "Tu carga está pendiente de confirmación. Te avisaremos cuando se acredite.",
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo cargar el saldo" }, { status: 500 });
  }
}
