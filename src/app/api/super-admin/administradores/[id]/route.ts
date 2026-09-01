import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return null;
  }
  return session;
}

// GET /api/super-admin/administradores/[id] — detalle completo de un admin
// Incluye: datos del admin, choferes, camiones, clientes, entregas, vueltas, gastos, pagos, config
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const admin = await db.usuario.findUnique({
      where: { id },
      select: {
        id: true, nombre: true, email: true, role: true, activo: true, creadoEn: true,
        telefono: true, licenciaClase: true, licenciaNumero: true, licenciaVencimiento: true,
      },
    });
    if (!admin || admin.role !== "dueno") {
      return NextResponse.json({ error: "Administrador no encontrado" }, { status: 404 });
    }

    const [
      choferes, camiones, clientes, entregas, vueltas, gastos, pagos, config,
    ] = await Promise.all([
      db.usuario.findMany({
        where: { duenoId: id, role: "chofer" },
        select: { id: true, nombre: true, email: true, telefono: true, activo: true, creadoEn: true, licenciaClase: true, licenciaNumero: true, licenciaVencimiento: true },
        orderBy: { nombre: "asc" },
      }),
      db.camion.findMany({
        where: { duenoId: id },
        select: { id: true, nombre: true, patente: true, capacidad: true, activo: true, marca: true, modelo: true, anio: true, color: true, creadoEn: true, permisoCirculacionVencimiento: true, revisionTecnicaVencimiento: true, seguroVencimiento: true },
        orderBy: { nombre: "asc" },
      }),
      db.cliente.findMany({
        where: { duenoId: id },
        select: { id: true, nombre: true, rut: true, telefono: true, email: true, zona: true, direccion: true, precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true, creadoEn: true, _count: { select: { entregas: true } } },
        orderBy: { nombre: "asc" },
      }),
      db.entrega.findMany({
        where: { duenoId: id },
        orderBy: { fecha: "desc" },
        take: 100,
        select: { id: true, fecha: true, clienteNombre: true, litros: true, total: true, montoRecibido: true, montoEfectivo: true, montoTransferencia: true, estadoPago: true, metodoPago: true, nota: true, vuelta: { select: { numero: true } } },
      }),
      db.vuelta.findMany({
        where: { duenoId: id },
        orderBy: { iniciadaEn: "desc" },
        take: 50,
        select: { id: true, numero: true, iniciadaEn: true, cerradaEn: true, activa: true, camion: { select: { nombre: true } }, chofer: { select: { nombre: true } }, _count: { select: { entregas: true } } },
      }),
      db.gasto.findMany({
        where: { duenoId: id },
        orderBy: { fecha: "desc" },
        take: 50,
        select: { id: true, fecha: true, tipo: true, descripcion: true, monto: true, pagadoPor: true },
      }),
      db.pago.findMany({
        where: { duenoId: id },
        orderBy: { fecha: "desc" },
        take: 50,
        select: { id: true, fecha: true, monto: true, metodoPago: true, nota: true, cliente: { select: { nombre: true } } },
      }),
      db.configuracion.findUnique({ where: { duenoId: id } }),
    ]);

    // Totales
    const ventasResult = await db.entrega.aggregate({ where: { duenoId: id }, _sum: { total: true, litros: true, montoEfectivo: true, montoTransferencia: true } });
    const gastosResult = await db.gasto.aggregate({ where: { duenoId: id }, _sum: { monto: true } });
    const pagosResult = await db.pago.aggregate({ where: { duenoId: id }, _sum: { monto: true } });

    return NextResponse.json({
      admin,
      choferes,
      camiones,
      clientes,
      entregas,
      vueltas,
      gastos,
      pagos,
      config,
      totales: {
        ventas: ventasResult._sum.total || 0,
        litros: ventasResult._sum.litros || 0,
        efectivo: ventasResult._sum.montoEfectivo || 0,
        transferencia: ventasResult._sum.montoTransferencia || 0,
        gastos: gastosResult._sum.monto || 0,
        pagosSueltos: pagosResult._sum.monto || 0,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener detalle del administrador" }, { status: 500 });
  }
}

// PATCH /api/super-admin/administradores/[id] — actualizar admin (nombre, email, telefono, activo, password)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.nombre !== undefined) data.nombre = String(body.nombre).trim();
    if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
    if (body.telefono !== undefined) data.telefono = body.telefono ? String(body.telefono).trim() : null;
    if (body.activo !== undefined) data.activo = !!body.activo;
    if (body.password) {
      data.passwordHash = await hashPassword(String(body.password));
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const actualizado = await db.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, telefono: true, activo: true },
    });

    return NextResponse.json({ usuario: actualizado });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo actualizar el administrador" }, { status: 500 });
  }
}

// DELETE /api/super-admin/administradores/[id] — eliminar admin Y todos sus datos
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  try {
    // Eliminar en orden (respetando foreign keys)
    // 1. Pagos
    await db.pago.deleteMany({ where: { duenoId: id } });
    // 2. Gastos
    await db.gasto.deleteMany({ where: { duenoId: id } });
    // 3. Entregas
    await db.entrega.deleteMany({ where: { duenoId: id } });
    // 4. Vueltas
    await db.vuelta.deleteMany({ where: { duenoId: id } });
    // 5. Pedidos
    await db.pedido.deleteMany({ where: { duenoId: id } });
    // 6. Clientes
    await db.cliente.deleteMany({ where: { duenoId: id } });
    // 7. CamionChofer (asignaciones)
    const camionesIds = (await db.camion.findMany({ where: { duenoId: id }, select: { id: true } })).map(c => c.id);
    if (camionesIds.length > 0) {
      await db.camionChofer.deleteMany({ where: { camionId: { in: camionesIds } } });
      // 8. Bitacora camion
      await db.bitacoraCamion.deleteMany({ where: { camionId: { in: camionesIds } } });
      // 9. Camiones
      await db.camion.deleteMany({ where: { duenoId: id } });
    }
    // 10. Pedidos recurrentes
    await db.pedidoRecurrente.deleteMany({ where: { duenoId: id } });
    // 11. Configuracion
    await db.configuracion.deleteMany({ where: { duenoId: id } });
    // 12. Choferes (usuarios donde duenoId = id)
    await db.usuario.deleteMany({ where: { duenoId: id, role: "chofer" } });
    // 13. El admin mismo
    await db.usuario.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo eliminar el administrador" }, { status: 500 });
  }
}
