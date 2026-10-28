// GET /api/akuosplash/transportista/entregas — historial de entregas del transportista
// POST /api/akuosplash/transportista/entregas — registra una entrega
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limite = Number(url.searchParams.get("limite") || "100");
  const entregas = await akuosplashDb.akuoEntrega.findMany({
    where: { transportistaId: user.id },
    orderBy: { creadoEn: "desc" },
    take: limite,
    include: {
      cliente: true,
      vehiculo: true,
      pedido: true,
    },
  });
  return NextResponse.json({ entregas });
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const clienteNombre = body.clienteNombre?.trim();
    if (!clienteNombre) {
      return NextResponse.json({ error: "Cliente es obligatorio" }, { status: 400 });
    }
    const litros = Number(body.litros);
    if (!litros || litros <= 0) {
      return NextResponse.json({ error: "Litros debe ser > 0" }, { status: 400 });
    }
    const total = Number(body.total) || 0;

    // Validar vehículo si viene
    let vehiculoId: string | null = null;
    if (body.vehiculoId) {
      const veh = await akuosplashDb.akuoVehiculo.findUnique({
        where: { id: body.vehiculoId },
      });
      if (!veh || veh.transportistaId !== user.id) {
        return NextResponse.json({ error: "Vehículo inválido" }, { status: 400 });
      }
      vehiculoId = veh.id;
    }

    // Validar cliente si viene
    let clienteId: string | null = null;
    if (body.clienteId) {
      const cli = await akuosplashDb.akuoCliente.findUnique({
        where: { id: body.clienteId },
      });
      if (!cli || cli.transportistaId !== user.id) {
        return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
      }
      clienteId = cli.id;
    }

    const montoEfectivo = Number(body.montoEfectivo) || 0;
    const montoTransferencia = Number(body.montoTransferencia) || 0;
    const montoRecibido = Number(body.montoRecibido) || montoEfectivo + montoTransferencia;

    // Estado de pago
    const metodoPago = body.metodoPago || "credito";
    let estadoPago = "pendiente";
    if (montoRecibido >= total && total > 0) {
      estadoPago = "pagado";
    } else if (montoRecibido > 0) {
      estadoPago = "parcial";
    }

    const entrega = await akuosplashDb.akuoEntrega.create({
      data: {
        transportistaId: user.id,
        clienteId,
        clienteNombre,
        clienteDireccion: body.clienteDireccion || null,
        clienteTelefono: body.clienteTelefono || null,
        clienteZona: body.clienteZona || null,
        clienteLat: body.clienteLat ? Number(body.clienteLat) : null,
        clienteLng: body.clienteLng ? Number(body.clienteLng) : null,
        vehiculoId,
        litros,
        total,
        montoEfectivo,
        montoTransferencia,
        montoRecibido,
        metodoPago,
        estadoPago,
        descuento: Number(body.descuento) || 0,
        descuentoPor: body.descuentoPor || null,
        fotoMedidorUrl: body.fotoMedidorUrl || null,
        nota: body.nota || null,
        detalleEstanquesJson: body.detalleEstanquesJson || null,
        lecturaAnterior: body.lecturaAnterior ? Number(body.lecturaAnterior) : null,
        lecturaActual: body.lecturaActual ? Number(body.lecturaActual) : null,
      },
    });

    // Si hay un pedido asociado, marcarlo como entregado
    if (body.pedidoId) {
      const pedido = await akuosplashDb.akuoPedido.findUnique({
        where: { id: body.pedidoId },
      });
      if (pedido && pedido.transportistaId === user.id) {
        await akuosplashDb.akuoPedido.update({
          where: { id: pedido.id },
          data: {
            estado: "entregado",
            entregaId: entrega.id,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, entrega });
  } catch (e) {
    console.error("AkuoSplash transportista/entregas POST error:", e);
    return NextResponse.json({ error: "No se pudo registrar la entrega" }, { status: 500 });
  }
}
