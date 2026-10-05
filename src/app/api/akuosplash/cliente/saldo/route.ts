import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/cliente/saldo
// Abona saldo al cliente. Métodos:
// - tarjeta_debito / tarjeta_credito: en producción esto va a Webpay/MercadoPago.
//   Por ahora sumamos el monto directamente (modo demo/dev).
// - transferencia: queda pendiente hasta que el admin confirme.
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente") return NextResponse.json({ error: "Solo clientes" }, { status: 403 });

  const body = await req.json();
  const monto = Number(body.monto);
  const metodo = body.metodoPago; // "tarjeta_debito" | "tarjeta_credito" | "transferencia"

  if (!monto || monto < 1000) {
    return NextResponse.json({ error: "Monto mínimo: $1.000" }, { status: 400 });
  }
  if (!["tarjeta_debito", "tarjeta_credito", "transferencia"].includes(metodo)) {
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }

  if (metodo === "transferencia") {
    // Queda pendiente hasta confirmación manual del admin
    // Guardamos una notificación para el superadmin
    const admins = await akuosplashDb.akuoUsuario.findMany({ where: { rol: "superadmin" } });
    for (const admin of admins) {
      await akuoNotificar(
        admin.id,
        "saldo_transferencia_pendiente",
        "Carga de saldo pendiente",
        `El cliente ${user.nombre} (${user.email}) solicitó abonar $${monto.toLocaleString("es-CL")} por transferencia. Pendiente de confirmación.`,
        "/akuosplash/superadmin",
      );
    }
    return NextResponse.json({
      ok: true,
      mensaje: "Carga pendiente. Te avisaremos cuando se acredite la transferencia.",
      estado: "pendiente",
    });
  }

  // Tarjeta de débito/crédito — en producción se redirige a Webpay/MercadoPago
  // Por ahora sumamos directo (modo demo/dev)
  const actualizado = await akuosplashDb.akuoUsuario.update({
    where: { id: user.id },
    data: { saldo: { increment: monto } },
  });

  return NextResponse.json({
    ok: true,
    estado: "acreditado",
    saldo: actualizado.saldo,
    mensaje: `Saldo abonado: $${monto.toLocaleString("es-CL")}. Saldo total: $${actualizado.saldo.toLocaleString("es-CL")}.`,
  });
}
