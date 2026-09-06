import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/pool/[id]/entregar — marcar un pedido como entregado
// Genera una Entrega en la base del admin que lo entregó (para que cuente en su liquidación)
// Body opcional: { litrosReales?, nota? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const pedido = await db.pedidoApp.findUnique({ where: { id } });
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.estado !== "asignado" && pedido.estado !== "en_camino") {
      return NextResponse.json({
        error: `No se puede entregar un pedido en estado ${pedido.estado}`,
      }, { status: 400 });
    }
    if (pedido.tomadoPorId !== session.userId) {
      return NextResponse.json({ error: "Solo quien tomó el pedido puede marcarlo como entregado" }, { status: 403 });
    }

    const ahora = new Date();
    const litrosReales = Number(body.litrosReales) || pedido.litros;

    // Actualizar historial
    let historial: any[] = [];
    try { historial = JSON.parse(pedido.historialJson || "[]"); } catch {}
    historial.push({ estado: "entregado", fecha: ahora.toISOString(), por: session.userId });

    // Crear una Entrega en la base del admin (para que cuente en su liquidación)
    const cliente = await db.clienteApp.findUnique({
      where: { id: pedido.clienteId },
      select: { nombre: true, telefono: true, direccion: true, zona: { select: { nombre: true } } },
    });

    // Buscar vuelta activa del chofer, o crear una si no hay
    let vueltaId: string | null = null;
    if (session.role === "chofer" || session.role === "dueno") {
      const vueltaActiva = await db.vuelta.findFirst({
        where: { activa: true, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) },
        orderBy: { iniciadaEn: "desc" },
      });
      vueltaId = vueltaActiva?.id ?? null;
    }

    // Precio por litro de la zona
    const zona = await db.zona.findUnique({
      where: { id: pedido.zonaId },
      select: { precioPorLitro: true },
    });

    const entregaAdmin = await db.entrega.create({
      data: {
        fecha: ahora,
        clienteNombre: cliente?.nombre || "Cliente App",
        clienteDireccion: pedido.direccion,
        clienteTelefono: cliente?.telefono || null,
        clienteZona: cliente?.zona?.nombre || null,
        clienteId: null, // no se vincula a un Cliente del admin (es un ClienteApp)
        vueltaId,
        choferId: session.userId,
        duenoId,
        litros: litrosReales,
        metodoPago: pedido.metodoPago === "saldo" ? "transferencia" : pedido.metodoPago,
        precioPorLitro: zona?.precioPorLitro || 0,
        total: pedido.montoProveedor, // el admin recibe el 90%
        montoEfectivo: 0,
        montoTransferencia: 0,
        montoRecibido: pedido.montoProveedor,
        estadoPago: "pagado",
        descuento: 0,
        descuentoTipo: "ninguno",
        descuentoPor: "dueno",
        nota: `Pedido App #${id.slice(-6)}${body.nota ? ` — ${body.nota}` : ""}`,
      },
    });

    // Marcar pedido como entregado
    await db.pedidoApp.update({
      where: { id },
      data: {
        estado: "entregado",
        entregadoEn: ahora,
        entregaAdminId: entregaAdmin.id,
        historialJson: JSON.stringify(historial),
        nota: body.nota ? `${pedido.nota || ""}\n[Entrega] ${body.nota}`.trim() : pedido.nota,
      },
    });

    // Sumar 1 a las entregas exitosas del cliente-app
    await db.clienteApp.update({
      where: { id: pedido.clienteId },
      data: { entregasExitosas: { increment: 1 } },
    });

    // Si el cliente no tenía proveedor preferido, este admin pasa a serlo
    const clienteApp = await db.clienteApp.findUnique({
      where: { id: pedido.clienteId },
      select: { proveedorPreferidoId: true },
    });
    if (clienteApp && !clienteApp.proveedorPreferidoId) {
      await db.clienteApp.update({
        where: { id: pedido.clienteId },
        data: { proveedorPreferidoId: duenoId },
      });
    }

    return NextResponse.json({
      ok: true,
      pedido: { id, estado: "entregado", entregadoEn: ahora },
      entregaAdmin: { id: entregaAdmin.id },
      mensaje: "Pedido entregado. Se registró en tu liquidación.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo marcar como entregado" }, { status: 500 });
  }
}
