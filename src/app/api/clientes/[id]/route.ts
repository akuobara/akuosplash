import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

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
          { error: "No tienes permiso para editar clientes. Pídele al administrador que habilite esta opción." },
          { status: 403 }
        ),
        session: null,
      };
    }
  }

  return { error: null, session, cliente };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

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
      ...(body.precioCamionCompleto !== undefined && { precioCamionCompleto: Number(body.precioCamionCompleto) || 0 }),
      ...(body.nota !== undefined && { nota: body.nota?.trim() || null }),
      ...(body.deudaInicial !== undefined && { deudaInicial: Number(body.deudaInicial) || 0 }),
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

  // === Propagar cambios de nombre/dirección/teléfono/zona a snapshots ===
  // El modelo de datos guarda snapshots (clienteNombre, clienteDireccion, etc.) en Pedidos y Entregas.
  // Si el cliente se renombra, los snapshots quedan con el nombre viejo y confunden al usuario.
  // Por eso propagamos el cambio a:
  //   - Pedidos pendientes/programados (no propagamos a entregados/cancelados para mantener histórico)
  //   - Entregas (todas, porque el snapshot es solo informativo)
  // Y solo si los campos relevantes cambiaron.
  if (body.nombre !== undefined || body.direccion !== undefined || body.telefono !== undefined || body.zona !== undefined || body.lat !== undefined || body.lng !== undefined || body.indicacionesAcceso !== undefined) {
    const snapData: any = {};
    if (body.nombre !== undefined) snapData.clienteNombre = actualizado.nombre;
    if (body.direccion !== undefined) snapData.clienteDireccion = actualizado.direccion;
    if (body.telefono !== undefined) snapData.clienteTelefono = actualizado.telefono;
    if (body.zona !== undefined) snapData.clienteZona = actualizado.zona;
    if (body.lat !== undefined) snapData.clienteLat = actualizado.lat;
    if (body.lng !== undefined) snapData.clienteLng = actualizado.lng;
    if (body.indicacionesAcceso !== undefined) snapData.indicacionesAcceso = actualizado.indicacionesAcceso;

    if (Object.keys(snapData).length > 0) {
      // Pedidos pendientes/programados (los entregados/cancelados conservan el snapshot histórico)
      await db.pedido.updateMany({
        where: {
          clienteId: id,
          estado: { in: ["pendiente", "programado"] },
        },
        data: snapData,
      });
      // Entregas: solo las que aún no están en una vuelta cerrada (todas las activas recientes).
      // Para no romper históricos viejos, solo propagamos a entregas de los últimos 30 días.
      const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await db.entrega.updateMany({
        where: {
          clienteId: id,
          fecha: { gte: hace30dias },
        },
        data: snapData,
      });
    }
  }

  return NextResponse.json({ cliente: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const { id } = await params;
  const { error: authError, session, cliente } = await checkOwnership(id);
  if (authError) return authError;
  if (!session || !cliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Choferes: solo pueden borrar clientes que ELLOS crearon (choferPreferidoId === session.userId)
  // y que no tengan entregas/pedidos asociados (para prevenir pérdida de historial).
  // Dueños: pueden borrar cualquier cliente de su flota (comportamiento existente).
  if (session.role === "chofer") {
    if (cliente.choferPreferidoId !== session.userId) {
      return NextResponse.json(
        { error: "Solo puedes eliminar clientes que tú creaste." },
        { status: 403 }
      );
    }
    // Verificar que no tenga entregas ni pedidos (sí tiene historial)
    const [entregasCount, pedidosCount] = await Promise.all([
      db.entrega.count({ where: { clienteId: id } }),
      db.pedido.count({ where: { clienteId: id } }),
    ]);
    if (entregasCount > 0 || pedidosCount > 0) {
      return NextResponse.json(
        { error: `Este cliente tiene ${entregasCount} entrega(s) y ${pedidosCount} pedido(s) asociados. No se puede eliminar para preservar el historial. Si igual querés borrarlo, pedíselo al administrador.` },
        { status: 400 }
      );
    }
  }

  // Transacción: desvincular relaciones + borrar pagos + borrar cliente (atómico)
  await db.$transaction(async (tx) => {
    // Desvincular relaciones opcionales (entregas, pedidos, recurrentes)
    await tx.cliente.update({
      where: { id },
      data: {
        entregas: { set: [] },
        pedidos: { set: [] },
        pedidosRecurrentes: { set: [] },
      },
    });

    // Borrar pagos sueltos del cliente (no se pueden desvincular porque clienteId es required)
    await tx.pago.deleteMany({ where: { clienteId: id } });

    // Borrar cliente
    await tx.cliente.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
