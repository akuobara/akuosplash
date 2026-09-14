import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";
import { checkDemoBlock } from "@/lib/demo-guard";
import { crearPreferenciaPedidoPago } from "@/lib/mercadopago";

// POST /api/cliente/pedidos — crear un pedido desde la app cliente
// Body: { litros, direccion?, lat?, lng?, indicacionesAcceso?, metodoPago, cuponCodigo?, nota? }
// Para metodoPago="tarjeta" devuelve { pedido, initPoint } y redirige a MercadoPago
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
        zona: { select: { id: true, nombre: true, precioPorLitro: true, litrosMinimos: true } },
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

    // Validar litros mínimos de la zona
    const minLitrosZona = cliente.zona.litrosMinimos ?? 1000;
    if (litros < minLitrosZona) {
      return NextResponse.json({ error: `La cantidad mínima es ${minLitrosZona} L` }, { status: 400 });
    }

    // Calcular monto
    const precioPorLitro = cliente.zona.precioPorLitro;
    const montoBruto = litros * precioPorLitro;
    const montoOriginal = Math.ceil(montoBruto / 100) * 100;

    // === Cupón de descuento ===
    let descuento = 0;
    let monto = montoOriginal;
    let cuponCodigo: string | null = null;
    let cuponId: string | null = null;

    const codigoIn = String(body.cuponCodigo || "").trim().toUpperCase();
    if (codigoIn) {
      const cupon = await db.cuponDescuento.findUnique({
        where: { codigo: codigoIn },
      });
      if (!cupon) {
        return NextResponse.json({ error: `El cupón "${codigoIn}" no existe` }, { status: 400 });
      }
      if (!cupon.activo) {
        return NextResponse.json({ error: "Este cupón ya no está activo" }, { status: 400 });
      }
      const ahora = new Date();
      if (cupon.validoDesde && ahora < cupon.validoDesde) {
        return NextResponse.json({ error: "Este cupón aún no es válido" }, { status: 400 });
      }
      if (cupon.validoHasta && ahora > cupon.validoHasta) {
        return NextResponse.json({ error: "Este cupón ya expiró" }, { status: 400 });
      }
      if (cupon.usosMaximos != null && cupon.usosActuales >= cupon.usosMaximos) {
        return NextResponse.json({ error: "Este cupón alcanzó su límite de usos" }, { status: 400 });
      }
      if (cupon.montoMinimo != null && montoOriginal < cupon.montoMinimo) {
        return NextResponse.json({
          error: `Necesitás un pedido mínimo de $${Math.round(cupon.montoMinimo).toLocaleString("es-CL")} para usar este cupón`,
        }, { status: 400 });
      }
      if (cupon.zonaId && cliente.zonaId !== cupon.zonaId) {
        return NextResponse.json({ error: "Este cupón no aplica para tu zona" }, { status: 400 });
      }
      // Calcular descuento
      if (cupon.tipo === "porcentaje") {
        descuento = Math.round(montoOriginal * (cupon.valor / 100));
      } else {
        descuento = Math.min(Math.round(cupon.valor), montoOriginal);
      }
      monto = Math.max(0, montoOriginal - descuento);
      cuponCodigo = cupon.codigo;
      cuponId = cupon.id;
    }

    const comisionApp = Math.round(monto * 0.10);
    const montoProveedor = monto - comisionApp;

    // Determinar método de pago
    const metodoPago = body.metodoPago || "saldo";
    if (!["saldo", "transferencia", "efectivo", "tarjeta", "mensual"].includes(metodoPago)) {
      return NextResponse.json({ error: "Método de pago no válido" }, { status: 400 });
    }
    if (metodoPago === "efectivo" && cliente.entregasExitosas < 10) {
      return NextResponse.json({
        error: "Para pagar en efectivo necesitás al menos 10 entregas exitosas",
      }, { status: 403 });
    }
    if (metodoPago === "mensual") {
      return NextResponse.json({ error: "Pago mensual no disponible todavía" }, { status: 400 });
    }

    // Si paga con saldo, verificar que tenga suficiente
    if (metodoPago === "saldo") {
      if (cliente.saldo < monto) {
        return NextResponse.json({
          error: `Saldo insuficiente. Necesitás $${Math.round(monto).toLocaleString("es-CL")} y tenés $${Math.round(cliente.saldo).toLocaleString("es-CL")}. Cargá saldo primero.`,
        }, { status: 400 });
      }
    }

    // Si monto es 0 (por descuento total) y método es tarjeta, no se requiere MP
    const montoPositivo = monto > 0;

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

    // estadoPago inicial:
    //   - saldo → "confirmado" (se descuenta ahora)
    //   - tarjeta con monto 0 → "confirmado" (no requiere MP)
    //   - tarjeta con monto > 0 → "pendiente" (hasta webhook de MP)
    //   - transferencia → "pendiente"
    //   - efectivo → "pendiente"
    const estadoPagoInicial =
      metodoPago === "saldo" ? "confirmado" :
      (metodoPago === "tarjeta" && !montoPositivo) ? "confirmado" :
      "pendiente";

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
        estadoPago: estadoPagoInicial,
        confirmadoEn: estadoPagoInicial === "confirmado" ? ahora : null,
        estado: estadoInicial,
        proveedorPreferidoNotificadoEn: tienePreferido ? ahora : null,
        plazoAceptacionPreferido: plazoPreferido,
        historialJson,
        nota: body.nota?.trim() || null,
        // Cupón
        cuponCodigo,
        descuento: descuento > 0 ? descuento : null,
        montoOriginal: descuento > 0 ? montoOriginal : null,
      },
    });

    // Si se aplicó un cupón, incrementar el contador de usos
    if (cuponId) {
      try {
        await db.cuponDescuento.update({
          where: { id: cuponId },
          data: { usosActuales: { increment: 1 } },
        });
      } catch (e) {
        // No fallar el pedido si el contador falla
        console.error("[cupones] No se pudo incrementar usosActuales:", e);
      }
    }

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

    // Si paga con tarjeta y el monto es positivo, crear preferencia de MercadoPago
    if (metodoPago === "tarjeta" && montoPositivo) {
      try {
        const pref = await crearPreferenciaPedidoPago({
          clienteId: cliente.id,
          clienteNombre: cliente.nombre,
          email: cliente.email,
          monto,
          pedidoId: pedido.id,
          litros,
          descripcion: `Pedido #${pedido.id.slice(-6)} — ${litros} L · ${cliente.zona?.nombre || ""}${cuponCodigo ? ` · Cupón ${cuponCodigo}` : ""}`,
        });

        // Guardar la preferenceId en el pedido
        await db.pedidoApp.update({
          where: { id: pedido.id },
          data: { mpPreferenceId: pref.preferenceId },
        });

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
            descuento: pedido.descuento,
            montoOriginal: pedido.montoOriginal,
            cuponCodigo: pedido.cuponCodigo,
          },
          initPoint: pref.initPoint,
          sandboxInitPoint: pref.sandboxInitPoint,
          preferenceId: pref.preferenceId,
          mensaje: "Pedido creado. Vas a ser redirigido a MercadoPago para pagar.",
        }, { status: 201 });
      } catch (e) {
        // Si MP falla, cancelar el pedido para que el cliente pueda reintentar
        await db.pedidoApp.update({
          where: { id: pedido.id },
          data: {
            estado: "cancelado",
            canceladoEn: new Date(),
            canceladoPor: "sistema",
            motivoCancelacion: "Error al crear preferencia de MercadoPago",
          },
        });
        // Revertir incremento del cupón si se aplicó
        if (cuponId) {
          try {
            await db.cuponDescuento.update({
              where: { id: cuponId },
              data: { usosActuales: { decrement: 1 } },
            });
          } catch {}
        }
        const msg = e instanceof Error ? e.message : "No se pudo crear el pago en MercadoPago";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
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
        descuento: pedido.descuento,
        montoOriginal: pedido.montoOriginal,
        cuponCodigo: pedido.cuponCodigo,
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
      descuento: true,
      montoOriginal: true,
      cuponCodigo: true,
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
