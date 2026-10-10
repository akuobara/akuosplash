import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { crearOrdenDirectaAkuo, calcularPrecioTotal } from "@/lib/akuosplash-mercadopago";
import {
  calcularPrecio,
  aplicarComision,
  REGLAS_DEFAULT,
  VERSION_MOTOR,
  type ReglaPrecio,
  type PrecioInput,
  type TipoMetodoPago,
  type TipoUrgencia,
} from "@/lib/precio-dinamico";

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

    // Calcular precio — usar motor dinámico si está habilitado, sino el estático
    const config = await akuosplashDb.akuoConfig.findFirst();
    let total: number;
    let comision: number;
    let snapshot: any = null;
    let precioDinamicoUsado = false;
    let precioPorLitroFinal: number | null = null;

    if (config?.precioDinamicoHabilitado) {
      // Motor dinámico
      let reglas: ReglaPrecio[] = REGLAS_DEFAULT;
      try {
        if (config.reglasPrecioJson) {
          const parsed = JSON.parse(config.reglasPrecioJson);
          if (Array.isArray(parsed)) reglas = parsed;
        }
      } catch {}

      if (!usuarioConZona?.zona) {
        return NextResponse.json({ error: "Zona no encontrada" }, { status: 400 });
      }
      const zona = usuarioConZona.zona;

      // Antigüedad
      const creadoEn = user.creadoEn instanceof Date ? user.creadoEn : new Date(user.creadoEn);
      const antiguedadMeses = Math.max(0, (Date.now() - creadoEn.getTime()) / (1000 * 60 * 60 * 24 * 30));

      // Mapear método de pago
      const metodoPagoStr = body.metodoPago || "tarjeta_debito";
      const metodoPagoMotor: TipoMetodoPago = metodoPagoStr.startsWith("tarjeta_credito")
        ? "credito"
        : metodoPagoStr.startsWith("tarjeta_debito")
          ? "tarjeta"
          : metodoPagoStr === "efectivo"
            ? "efectivo"
            : metodoPagoStr === "transferencia"
              ? "transferencia"
              : "tarjeta";
      const urgenciaMotor: TipoUrgencia = (body.urgencia as TipoUrgencia) || "standard";
      const horario = body.fechaDeseada ? new Date(body.fechaDeseada) : new Date();

      const input: PrecioInput = {
        litros: Number(body.litros) || 1000,
        metodoPago: metodoPagoMotor,
        urgencia: urgenciaMotor,
        horario,
        clienteLat: body.lat ? Number(body.lat) : (user.lat ?? null),
        clienteLng: body.lng ? Number(body.lng) : (user.lng ?? null),
        clienteDeuda: 0, // fase 1: sin deuda
        clienteAntiguedadMeses: antiguedadMeses,
        zonaPrecioBase: zona.precioPorLitro,
        zonaPrecioMinimoLitro: zona.precioMinimoPorLitro ?? null,
        zonaPrecioMinimoTotal: zona.precioMinimoTotal ?? null,
        zonaPrecioMaximoLitro: zona.precioMaximoPorLitro ?? null,
        depotLat: config.depotLat ?? null,
        depotLng: config.depotLng ?? null,
      };

      const resultado = aplicarComision(calcularPrecio(input, reglas), config.comisionPorcentaje);
      total = resultado.total;
      comision = resultado.comision;
      precioPorLitroFinal = resultado.precioPorLitroFinal;
      precioDinamicoUsado = true;
      snapshot = {
        version: VERSION_MOTOR,
        creadoEn: new Date().toISOString(),
        input,
        resultado,
      };
    } else {
      // Precio estático (legacy)
      const precioCalc = await calcularPrecioTotal(Number(body.litros), usuarioConZona.zonaId);
      if (!precioCalc) {
        return NextResponse.json({ error: "No se pudo calcular el precio (zona inválida)" }, { status: 400 });
      }
      total = precioCalc.total;
      comision = precioCalc.comision;
    }

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
        // Precio dinámico snapshot
        precioSnapshotJson: snapshot ? JSON.stringify(snapshot) : null,
        precioDinamicoHabilitado: precioDinamicoUsado,
        precioPorLitroFinal,
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
          comisionApp: comision,
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
