import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { crearPreferenciaPedidoAkuo, calcularPrecioTotal } from "@/lib/akuosplash-mercadopago";

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
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente") return NextResponse.json({ error: "Solo clientes pueden pedir" }, { status: 403 });
  const body = await req.json();
  if (!body.direccion?.trim() || !body.litros) return NextResponse.json({ error: "Dirección y litros son obligatorios" }, { status: 400 });

  // El código siempre se genera — el repartidor lo necesitará al finalizar la entrega
  const codigoConfirmacion = generarCodigoConfirmacion();
  // El precio depende de la zona del cliente (lat/lng o comuna)
  const lat = body.lat ? Number(body.lat) : (user as any).lat;
  const lng = body.lng ? Number(body.lng) : (user as any).lng;
  const comuna = body.comuna?.trim() || (user as any).comuna || undefined;
  const { total } = await calcularPrecioTotal(Number(body.litros), lat, lng, comuna);

  const pedido = await akuosplashDb.akuoPedidoCliente.create({
    data: {
      clienteId: user.id,
      litros: Number(body.litros) || 1000,
      direccion: body.direccion.trim(),
      comuna: comuna || null,
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

  // Si el método de pago es tarjeta (débito/crédito), crear preferencia de MercadoPago
  if (body.metodoPago === "tarjeta_debito" || body.metodoPago === "tarjeta_credito" || !body.metodoPago) {
    try {
      const pref = await crearPreferenciaPedidoAkuo({
        clienteId: user.id,
        clienteNombre: user.nombre,
        email: user.email || "",
        monto: total,
        pedidoId: pedido.id,
        litros: Number(body.litros) || 1000,
      });

      await akuosplashDb.akuoPedidoCliente.update({
        where: { id: pedido.id },
        data: { mpPreferenceId: pref.preferenceId },
      });

      return NextResponse.json({
        ok: true,
        pedido,
        initPoint: pref.initPoint,
        preferenceId: pref.preferenceId,
      }, { status: 201 });
    } catch (e: any) {
      await akuosplashDb.akuoPedidoCliente.delete({ where: { id: pedido.id } }).catch(() => {});
      return NextResponse.json({ error: e.message || "No se pudo iniciar el pago con MercadoPago. Verificá que las credenciales estén configuradas." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, pedido }, { status: 201 });
}

