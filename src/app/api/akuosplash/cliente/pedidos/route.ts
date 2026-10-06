import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { crearOrdenDirectaAkuo, calcularPrecioTotal } from "@/lib/akuosplash-mercadopago";

// Código PIN simple de 4 dígitos (0-9)
function generarCodigoConfirmacion(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return String(n);
}

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo clientes" }, { status: 403 });
  const pedidos = await akuosplashDb.akuoPedidoCliente.findMany({
    where: { clienteId: user.id },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({ pedidos });
}

export async function POST(req: NextRequest) {
  try {
    const user = await akuoGetCurrentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.rol !== "cliente") return NextResponse.json({ error: "Solo clientes pueden pedir" }, { status: 403 });
    const body = await req.json();
    if (!body.direccion?.trim() || !body.litros) return NextResponse.json({ error: "Dirección y litros son obligatorios" }, { status: 400 });

    // Recargar usuario con su zona
    const usuarioConZona = await akuosplashDb.akuoUsuario.findUnique({
      where: { id: user.id },
      include: { zona: true },
    });
    if (!usuarioConZona) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!usuarioConZona.zonaId || !usuarioConZona.zona) {
      return NextResponse.json({ error: "No tenés zona de servicio asignada. Contactá soporte." }, { status: 400 });
    }

    // El código siempre se genera — el repartidor lo necesitará al finalizar la entrega
    const codigoConfirmacion = generarCodigoConfirmacion();
    // El precio sale de la zona asignada al usuario
    const precioCalc = await calcularPrecioTotal(Number(body.litros), usuarioConZona.zonaId);
    if (!precioCalc) {
      return NextResponse.json({ error: "No se pudo calcular el precio (zona inválida)" }, { status: 400 });
    }
    const total = precioCalc.total;

    const pedido = await akuosplashDb.akuoPedidoCliente.create({
      data: {
        clienteId: user.id,
        litros: Number(body.litros) || 1000,
        direccion: body.direccion.trim(),
        comuna: body.comuna?.trim() || null,
        lat: body.lat ? Number(body.lat) : null,
        lng: body.lng ? Number(body.lng) : null,
        fechaDeseada: body.fechaDeseada ? new Date(body.fechaDeseada) : null,
        franjaHoraria: body.franjaHoraria || null,
        metodoPago: body.metodoPago || "tarjeta_debito",
        nota: body.nota?.trim() || null,
        estado: "pendiente",
        codigoConfirmacion,
        codigoGeneradoEn: new Date(),
        precioTotal: total,
        estadoPago: "pendiente",
      },
    });

    // Pago directo con tarjeta via Orders API (sin redirect a MP)
    if (body.metodoPago === "tarjeta_debito" || body.metodoPago === "tarjeta_credito" || !body.metodoPago) {
      try {
        if (!body.cardToken) {
          await akuosplashDb.akuoPedidoCliente.delete({ where: { id: pedido.id } }).catch(() => {});
          return NextResponse.json({ error: "Falta el token de la tarjeta (cardToken)" }, { status: 400 });
        }

        // Si el pedido tiene repartidor asignado y ese repartidor tiene MP conectado, hacer split
        let repartidorMpAccessToken: string | null = null;
        let repartidorMpUserId: string | null = null;
        if (pedido.transportistaId) {
          const repartidor = await akuosplashDb.akuoUsuario.findUnique({
            where: { id: pedido.transportistaId },
            select: { mpAccessToken: true, mpUserId: true, mpTokenExpiresAt: true },
          });
          if (repartidor?.mpAccessToken && repartidor?.mpUserId) {
            const expiresAt = repartidor.mpTokenExpiresAt;
            if (!expiresAt || expiresAt.getTime() - Date.now() > 3600 * 1000) {
              repartidorMpAccessToken = repartidor.mpAccessToken;
              repartidorMpUserId = repartidor.mpUserId;
            }
          }
        }

        const orden = await crearOrdenDirectaAkuo({
          clienteId: user.id,
          clienteNombre: user.nombre,
          email: user.email || "",
          monto: total,
          pedidoId: pedido.id,
          litros: Number(body.litros) || 1000,
          comisionApp: precioCalc.comision,
          cardToken: body.cardToken,
          installments: body.installments || 1,
          cardFirstSix: body.cardFirstSix,
          repartidorMpAccessToken,
          repartidorMpUserId,
        });

        // Guardar el orderId y estado
        await akuosplashDb.akuoPedidoCliente.update({
          where: { id: pedido.id },
          data: {
            mpPreferenceId: orden.orderId,
            // Si el pago se aprobó inmediatamente, marcarlo
            estadoPago: orden.status === "approved" ? "pagado" : (orden.status === "rejected" ? "rechazado" : "pendiente"),
            mpPaymentId: orden.orderId,
          },
        });

        return NextResponse.json({
          ok: true,
          pedido,
          orderId: orden.orderId,
          status: orden.status,
          redirectUrl: orden.redirectUrl, // solo si requiere 3DS
          splitPayment: orden.splitPayment,
          detail: orden.detail,
        }, { status: 201 });
      } catch (e: any) {
        await akuosplashDb.akuoPedidoCliente.delete({ where: { id: pedido.id } }).catch(() => {});
        console.error("MP order error:", e.message, e.stack);
        return NextResponse.json({
          error: e.message || "No se pudo procesar el pago",
          errorName: e.name,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, pedido }, { status: 201 });
  } catch (e: any) {
    console.error("POST pedidos outer error:", e.message, e.stack);
    return NextResponse.json({
      error: e.message || "Error interno del servidor",
      errorName: e.name,
      stack: e.stack?.split("\n").slice(0, 5),
    }, { status: 500 });
  }
}
