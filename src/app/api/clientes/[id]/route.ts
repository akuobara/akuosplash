import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkOwnership(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };

  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) {
    return { error: NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 }), session: null };
  }

  const duenoId = session.role === "dueno" ? session.userId : session.duenoId;
  if (cliente.duenoId !== duenoId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }

  // Si es chofer, verificar permiso de edición
  if (session.role === "chofer") {
    const config = await db.configuracion.findUnique({ where: { duenoId } });
    if (!config?.choferesPuedenEditarClientes) {
      return {
        error: NextResponse.json(
          { error: "No tienes permiso para editar clientes. Pídele al dueño que habilite esta opción." },
          { status: 403 }
        ),
        session: null,
      };
    }
  }

  return { error: null, session, cliente };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await checkOwnership(await params.then(p => p.id));
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();

  const actualizado = await db.cliente.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.rut !== undefined && { rut: body.rut?.trim() || null }),
      ...(body.direccion !== undefined && { direccion: body.direccion?.trim() || null }),
      ...(body.telefono !== undefined && { telefono: body.telefono?.trim() || null }),
      ...(body.email !== undefined && { email: body.email?.trim() || null }),
      ...(body.zona !== undefined && { zona: body.zona?.trim() || null }),
      ...(body.precioEfectivoPorLitro !== undefined && { precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0 }),
      ...(body.precioTransferenciaPorLitro !== undefined && { precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0 }),
      ...(body.nota !== undefined && { nota: body.nota?.trim() || null }),
      ...(body.lat !== undefined && { lat: body.lat === null || body.lat === "" ? null : Number(body.lat) }),
      ...(body.lng !== undefined && { lng: body.lng === null || body.lng === "" ? null : Number(body.lng) }),
      ...(body.requiereIngresoPropiedad !== undefined && { requiereIngresoPropiedad: !!body.requiereIngresoPropiedad }),
      ...(body.entregaDesdeAfuera !== undefined && { entregaDesdeAfuera: !!body.entregaDesdeAfuera }),
      ...(body.conexionExterna !== undefined && { conexionExterna: !!body.conexionExterna }),
      ...(body.requiereClientePresente !== undefined && { requiereClientePresente: !!body.requiereClientePresente }),
      ...(body.indicacionesAcceso !== undefined && { indicacionesAcceso: body.indicacionesAcceso?.trim() || null }),
      ...(body.usoAgua !== undefined && { usoAgua: body.usoAgua }),
      ...(body.usoAguaNota !== undefined && { usoAguaNota: body.usoAguaNota?.trim() || null }),
      ...(body.estanquesJson !== undefined && { estanquesJson: body.estanquesJson || null }),
      ...(body.choferPreferidoId !== undefined && { choferPreferidoId: (body.choferPreferidoId && body.choferPreferidoId !== "__ninguno") ? body.choferPreferidoId : null }),
    },
  });

  return NextResponse.json({ cliente: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error: authError } = await checkOwnership(id);
  if (authError) return authError;

  // Desvincular relaciones opcionales (entregas, pedidos) antes de borrar
  await db.cliente.update({
    where: { id },
    data: {
      entregas: { set: [] },
      pedidos: { set: [] },
      pedidosRecurrentes: { set: [] },
    },
  });

  // Borrar pagos sueltos del cliente (no se pueden desvincular porque clienteId es required)
  await db.pago.deleteMany({ where: { clienteId: id } });

  await db.cliente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
