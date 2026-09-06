import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/cliente/pedidos — crear un pedido desde la app cliente
// Body: { litros, direccion?, lat?, lng?, indicacionesAcceso?, metodoPago, usarSaldo?, nota? }
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validar litros
    const litros = Number(body.litros);
    if (!litros || litros < 100) {
      return NextResponse.json({ error: "Ingresá una cantidad válida de litros (mínimo 100)" }, { status: 400 });
    }

    // Cargar cliente con su zona y saldo
    const cliente = await db.clienteApp.findUnique({
      where: { id: session.clienteId },
      select: {
        id: true, nombre: true, email: true,
        zonaId: true, direccion: true, lat: true, lng: true,
        indicacionesAcceso: true,
        saldo: true,
        entregasExitosas: true,
        zona: { select: { id: true, nombre: true, precioPorLitro: true } },
        proveedorPreferidoId: true,
        tiempoAceptacionPreferidoMin: true,
      },
    });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (!cliente.zonaId || !cliente.zona) {
      return NextResponse.json({ error: "No tenés zona asignada. Contactá soporte." }, { status: 400 });
    }

    // Validar que no tenga ya un pedido activo (en_pool, preferido_notificado, asignado, en_camino)
    const pedidosActivos = await db.pedidoApp.count({
      where: {
        clienteId: cliente.id,
        estado: { in: ["en_pool", "preferido_notificado", "asignado", "en_camino"] },
      },
    });
    if (pedidosActivos > 0) {
      return NextResponse.json({ error: "Ya tenés un pedido en curso. Esperá a que se entregue o cancelá el actual." }, { status: 400 });
    }

    // Calcular monto
    const precioPorLitro = cliente.zona.precioPorLitro;
    const montoBruto = litros * precioPorLitro;
    // Redondear a $100 superior
    const monto = Math.ceil(montoBruto / 100) * 100;
    const comisionApp = Math.round(monto * 0.10);
    const montoProveedor = monto - comisionApp;

    // Determinar método de pago
    const metodoPago = body.metodoPago || "saldo";
    if (!["saldo", "transferencia", "efectivo", "mensual"].includes(metodoPago)) {
      return NextResponse.json({ error: "Método de pago no válido" }, { status: 400 });
    }
    if (metodoPago === "efectivo" && cliente.entregasExitosas < 10) {
      return NextResponse.json({
        error: "Para pagar en efectivo necesitás al menos 10 entregas exitosas",
      }, { status: 403 });
    }
    if (metodoPago === "mensual") {
      // TODO: verificar que el cliente tenga el plan mensual habilitado (futura feature)
      return NextResponse.json({ error: "Pago mensual no disponible todavía" }, { status: 400 });
    }

    // Si paga con saldo, verificar que tenga suficiente
    if (metodoPago === "saldo") {
      if (cliente.saldo < monto) {
        return NextResponse.json({
          error: `Saldo insuficiente. Necesitás ${monto} y tenés ${cliente.saldo}. Cargá saldo primero.`,
        }, { status: 400 });
      }
    }

    // Dirección: usar la del body o la del cliente
    const direccion = body.direccion?.trim() || cliente.direccion || "";
    const lat = body.lat != null && body.lat !== "" ? Number(body.lat) : cliente.lat;
    const lng = body.lng != null && body.lng !== "" ? Number(body.lng) : cliente.lng;
    const indicacionesAcceso = body.indicacionesAcceso?.trim() || cliente.indicacionesAcceso || null;

    // Crear pedido
    // Estado inicial:
    //   - Si tiene proveedor preferido → "preferido_notificado" + plazo
    //   - Si no tiene → "en_pool"
    const tienePreferido = !!cliente.proveedorPreferidoId;
    const estadoInicial = tienePreferido ? "preferido_notificado" : "en_pool";
    const ahora = new Date();
    const plazoPreferido = tienePreferido
      ? new Date(ahora.getTime() + (cliente.tiempoAceptacionPreferidoMin || 15) * 60 * 1000)
      : null;

    // Historial inicial
    const historialJson = JSON.stringify([
      { estado: estadoInicial, fecha: ahora.toISOString(), por: "cliente" },
    ]);

    const pedido = await db.pedidoApp.create({
      data: {
        clienteId: cliente.id,
        litros,
        zonaId: cliente.zonaId,
        direccion,
        lat,
        lng,
        indicacionesAcceso,
        metodoPago,
        monto,
        comisionApp,
        montoProveedor,
        estadoPago: metodoPago === "saldo" ? "confirmado" : "pendiente",
        confirmadoEn: metodoPago === "saldo" ? ahora : null,
        estado: estadoInicial,
        proveedorPreferidoNotificadoEn: tienePreferido ? ahora : null,
        plazoAceptacionPreferido: plazoPreferido,
        historialJson,
        nota: body.nota?.trim() || null,
      },
    });

    // Si paga con saldo, descontar del saldo y crear movimiento
    if (metodoPago === "saldo") {
      const nuevoSaldo = cliente.saldo - monto;
      await db.$transaction([
        db.clienteApp.update({
          where: { id: cliente.id },
          data: { saldo: nuevoSaldo },
        }),
        db.movimientoSaldoClienteApp.create({
          data: {
            clienteId: cliente.id,
            tipo: "pago_pedido",
            monto: -monto,
            saldoResultante: nuevoSaldo,
            descripcion: `Pago de pedido #${pedido.id.slice(-6)} (${litros} L)`,
            pedidoAppId: pedido.id,
            confirmado: true,
            confirmadoEn: ahora,
          },
        }),
      ]);
    }

    return NextResponse.json({
      pedido: {
        id: pedido.id,
        litros: pedido.litros,
        monto: pedido.monto,
        comisionApp: pedido.comisionApp,
        montoProveedor: pedido.montoProveedor,
        metodoPago: pedido.metodoPago,
        estado: pedido.estado,
        estadoPago: pedido.estadoPago,
        zona: cliente.zona.nombre,
        creadoEn: pedido.creadoEn,
      },
      mensaje: tienePreferido
        ? `Pedido creado. Tu proveedor preferido tiene ${cliente.tiempoAceptacionPreferidoMin} min para aceptar. Si no acepta, cae al pool general.`
        : "Pedido creado y enviado al pool. Un chofer lo va a tomar pronto.",
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
  }
}

// GET /api/cliente/pedidos — lista de pedidos del cliente
export async function GET() {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await db.pedidoApp.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { creadoEn: "desc" },
    take: 50,
    select: {
      id: true,
      creadoEn: true,
      litros: true,
      monto: true,
      estado: true,
      estadoPago: true,
      metodoPago: true,
      direccion: true,
      nota: true,
      tomadoEn: true,
      entregadoEn: true,
      canceladoEn: true,
      canceladoPor: true,
      motivoCancelacion: true,
      reembolsoMonto: true,
      penalizacionCancelacion: true,
      tomadoPor: { select: { id: true, nombre: true } },
      zona: { select: { id: true, nombre: true, precioPorLitro: true } },
    },
  });

  return NextResponse.json({ pedidos });
}
