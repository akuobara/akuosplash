import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// Tipos de recurso soportados
type TipoRecurso = "cliente" | "chofer" | "camion" | "entrega" | "vuelta" | "gasto" | "pago";

// POST /api/super-admin/administradores/[id]/recurso?tipo=X
// Crea un nuevo recurso asociado al admin
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as TipoRecurso;
  const body = await req.json();

  try {
    let creado: any;
    switch (tipo) {
      case "cliente":
        creado = await db.cliente.create({
          data: {
            duenoId: id,
            nombre: body.nombre?.trim() || "Sin nombre",
            rut: body.rut?.trim() || null,
            direccion: body.direccion?.trim() || null,
            telefono: body.telefono?.trim() || null,
            email: body.email?.trim() || null,
            zona: body.zona?.trim() || null,
            precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0,
            precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0,
          },
        });
        break;
      case "chofer":
        if (!body.email?.trim() || !body.password) {
          return NextResponse.json({ error: "Email y password son obligatorios" }, { status: 400 });
        }
        creado = await db.usuario.create({
          data: {
            nombre: body.nombre?.trim() || "Sin nombre",
            email: body.email.trim().toLowerCase(),
            passwordHash: hashPassword(String(body.password)),
            telefono: body.telefono?.trim() || null,
            role: "chofer",
            duenoId: id,
            activo: body.activo !== false,
          },
        });
        break;
      case "camion":
        creado = await db.camion.create({
          data: {
            duenoId: id,
            nombre: body.nombre?.trim() || "Camión",
            patente: body.patente?.trim() || null,
            capacidad: Number(body.capacidad) || 17000,
            activo: body.activo !== false,
            marca: body.marca?.trim() || null,
            modelo: body.modelo?.trim() || null,
            anio: body.anio ? Number(body.anio) : null,
            color: body.color?.trim() || null,
          },
        });
        break;
      default:
        return NextResponse.json({ error: "Tipo no soportado para creación" }, { status: 400 });
    }
    return NextResponse.json({ recurso: creado }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear el recurso" }, { status: 500 });
  }
}

// PATCH /api/super-admin/administradores/[id]/recurso?tipo=X&itemId=Y
// Edita un recurso existente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as TipoRecurso;
  const itemId = searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId es obligatorio" }, { status: 400 });
  const body = await req.json();

  try {
    let actualizado: any;
    switch (tipo) {
      case "cliente":
        actualizado = await db.cliente.update({
          where: { id: itemId },
          data: {
            ...(body.nombre !== undefined && { nombre: String(body.nombre).trim() }),
            ...(body.rut !== undefined && { rut: body.rut ? String(body.rut).trim() : null }),
            ...(body.direccion !== undefined && { direccion: body.direccion ? String(body.direccion).trim() : null }),
            ...(body.telefono !== undefined && { telefono: body.telefono ? String(body.telefono).trim() : null }),
            ...(body.email !== undefined && { email: body.email ? String(body.email).trim() : null }),
            ...(body.zona !== undefined && { zona: body.zona ? String(body.zona).trim() : null }),
            ...(body.precioEfectivoPorLitro !== undefined && { precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0 }),
            ...(body.precioTransferenciaPorLitro !== undefined && { precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0 }),
          },
        });
        break;
      case "chofer":
        const dataChofer: Record<string, unknown> = {};
        if (body.nombre !== undefined) dataChofer.nombre = String(body.nombre).trim();
        if (body.email !== undefined) dataChofer.email = String(body.email).trim().toLowerCase();
        if (body.telefono !== undefined) dataChofer.telefono = body.telefono ? String(body.telefono).trim() : null;
        if (body.activo !== undefined) dataChofer.activo = !!body.activo;
        if (body.password) dataChofer.passwordHash = hashPassword(String(body.password));
        actualizado = await db.usuario.update({ where: { id: itemId }, data: dataChofer });
        break;
      case "camion":
        const dataCamion: Record<string, unknown> = {};
        if (body.nombre !== undefined) dataCamion.nombre = String(body.nombre).trim();
        if (body.patente !== undefined) dataCamion.patente = body.patente ? String(body.patente).trim() : null;
        if (body.capacidad !== undefined) dataCamion.capacidad = Number(body.capacidad) || 17000;
        if (body.activo !== undefined) dataCamion.activo = !!body.activo;
        if (body.marca !== undefined) dataCamion.marca = body.marca ? String(body.marca).trim() : null;
        if (body.modelo !== undefined) dataCamion.modelo = body.modelo ? String(body.modelo).trim() : null;
        if (body.anio !== undefined) dataCamion.anio = body.anio ? Number(body.anio) : null;
        if (body.color !== undefined) dataCamion.color = body.color ? String(body.color).trim() : null;
        actualizado = await db.camion.update({ where: { id: itemId }, data: dataCamion });
        break;
      case "entrega":
        const dataEntrega: Record<string, unknown> = {};
        if (body.litros !== undefined) dataEntrega.litros = Number(body.litros);
        if (body.total !== undefined) dataEntrega.total = Number(body.total);
        if (body.montoEfectivo !== undefined) dataEntrega.montoEfectivo = Number(body.montoEfectivo);
        if (body.montoTransferencia !== undefined) dataEntrega.montoTransferencia = Number(body.montoTransferencia);
        if (body.estadoPago !== undefined) dataEntrega.estadoPago = String(body.estadoPago);
        if (body.nota !== undefined) dataEntrega.nota = body.nota ? String(body.nota).trim() : null;
        actualizado = await db.entrega.update({ where: { id: itemId }, data: dataEntrega });
        break;
      case "vuelta":
        const dataVuelta: Record<string, unknown> = {};
        if (body.nota !== undefined) dataVuelta.nota = body.nota ? String(body.nota).trim() : null;
        if (body.activa !== undefined) dataVuelta.activa = !!body.activa;
        actualizado = await db.vuelta.update({ where: { id: itemId }, data: dataVuelta });
        break;
      case "gasto":
        const dataGasto: Record<string, unknown> = {};
        if (body.tipo !== undefined) dataGasto.tipo = String(body.tipo);
        if (body.descripcion !== undefined) dataGasto.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
        if (body.monto !== undefined) dataGasto.monto = Number(body.monto);
        if (body.pagadoPor !== undefined) dataGasto.pagadoPor = String(body.pagadoPor);
        actualizado = await db.gasto.update({ where: { id: itemId }, data: dataGasto });
        break;
      case "pago":
        const dataPago: Record<string, unknown> = {};
        if (body.monto !== undefined) dataPago.monto = Number(body.monto);
        if (body.metodoPago !== undefined) dataPago.metodoPago = String(body.metodoPago);
        if (body.nota !== undefined) dataPago.nota = body.nota ? String(body.nota).trim() : null;
        actualizado = await db.pago.update({ where: { id: itemId }, data: dataPago });
        break;
      default:
        return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
    }
    return NextResponse.json({ recurso: actualizado });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

// DELETE /api/super-admin/administradores/[id]/recurso?tipo=X&itemId=Y
// Elimina un recurso
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as TipoRecurso;
  const itemId = searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId es obligatorio" }, { status: 400 });

  try {
    switch (tipo) {
      case "cliente":
        // Revertir pedidos vinculados
        await db.pedido.updateMany({ where: { clienteId: itemId }, data: { clienteId: null } });
        await db.cliente.delete({ where: { id: itemId } });
        break;
      case "chofer":
        await db.usuario.delete({ where: { id: itemId } });
        break;
      case "camion":
        // Eliminar asignaciones y bitácora primero
        await db.camionChofer.deleteMany({ where: { camionId: itemId } });
        await db.bitacoraCamion.deleteMany({ where: { camionId: itemId } });
        await db.camion.delete({ where: { id: itemId } });
        break;
      case "entrega":
        // Revertir pedido vinculado
        await db.pedido.updateMany({ where: { entregaId: itemId }, data: { estado: "pendiente", entregaId: null, vueltaId: null } });
        await db.entrega.delete({ where: { id: itemId } });
        break;
      case "vuelta":
        // Desvincular entregas de la vuelta
        await db.entrega.updateMany({ where: { vueltaId: itemId }, data: { vueltaId: null } });
        await db.pedido.updateMany({ where: { vueltaId: itemId }, data: { vueltaId: null } });
        await db.vuelta.delete({ where: { id: itemId } });
        break;
      case "gasto":
        await db.gasto.delete({ where: { id: itemId } });
        break;
      case "pago":
        await db.pago.delete({ where: { id: itemId } });
        break;
      default:
        return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }
}
