import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/clientes/[id] — actualizar cliente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await akuoGetCurrentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.rol !== "transportista" && user.rol !== "superadmin") {
      return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
    }
    const { id } = await params;
    const cliente = await akuosplashDb.akuoCliente.findUnique({ where: { id } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    // El superadmin puede editar cualquier cliente (para soporte/debug)
    // Los transportistas solo pueden editar los suyos
    if (user.rol !== "superadmin" && cliente.transportistaId !== user.id) {
      return NextResponse.json(
        { error: "Este cliente no te pertenece. Solo el superadmin puede editar clientes de otros transportistas." },
        { status: 403 }
      );
    }
    const body = await req.json();
    const data: any = {};
    if (body.nombre !== undefined) data.nombre = body.nombre.trim();
    if (body.telefono !== undefined) data.telefono = body.telefono || null;
    if (body.direccion !== undefined) data.direccion = body.direccion || null;
    if (body.zona !== undefined) data.zona = body.zona || null;
    if (body.lat !== undefined) data.lat = body.lat ? Number(body.lat) : null;
    if (body.lng !== undefined) data.lng = body.lng ? Number(body.lng) : null;
    if (body.precioEfectivoPorLitro !== undefined) data.precioEfectivoPorLitro = Number(body.precioEfectivoPorLitro) || 0;
    if (body.precioTransferenciaPorLitro !== undefined) data.precioTransferenciaPorLitro = Number(body.precioTransferenciaPorLitro) || 0;
    if (body.nota !== undefined) data.nota = body.nota || null;
    if (body.estanquesJson !== undefined) data.estanquesJson = body.estanquesJson || null;
    if (body.requiereIngresoPropiedad !== undefined) data.requiereIngresoPropiedad = !!body.requiereIngresoPropiedad;
    if (body.entregaDesdeAfuera !== undefined) data.entregaDesdeAfuera = !!body.entregaDesdeAfuera;
    if (body.conexionExterna !== undefined) data.conexionExterna = !!body.conexionExterna;
    if (body.indicacionesAcceso !== undefined) data.indicacionesAcceso = body.indicacionesAcceso || null;

    const actualizado = await akuosplashDb.akuoCliente.update({ where: { id }, data });
    return NextResponse.json({ ok: true, cliente: actualizado });
  } catch (e: any) {
    console.error("[PATCH /api/akuosplash/clientes/[id]]", e);
    return NextResponse.json({ error: e?.message || "Error interno" }, { status: 500 });
  }
}

// DELETE /api/akuosplash/clientes/[id] — eliminar cliente
// Query param: ?hard=true para borrado físico (en vez de soft delete)
// El superadmin puede borrar cualquier cliente. Los transportistas solo los suyos.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await akuoGetCurrentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.rol !== "transportista" && user.rol !== "superadmin") {
      return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
    }
    const { id } = await params;
    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "true";

    const cliente = await akuosplashDb.akuoCliente.findUnique({ where: { id } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (user.rol !== "superadmin" && cliente.transportistaId !== user.id) {
      return NextResponse.json(
        { error: "Este cliente no te pertenece. Solo el superadmin puede eliminar clientes de otros transportistas." },
        { status: 403 }
      );
    }

    if (hard) {
      // Borrado físico — útil para eliminar duplicados
      await akuosplashDb.akuoCliente.delete({ where: { id } });
      return NextResponse.json({ ok: true, modo: "hard" });
    } else {
      // Soft delete (default) — marca como inactivo
      await akuosplashDb.akuoCliente.update({ where: { id }, data: { activo: false } });
      return NextResponse.json({ ok: true, modo: "soft" });
    }
  } catch (e: any) {
    console.error("[DELETE /api/akuosplash/clientes/[id]]", e);
    // Si el error es por foreign key (cliente con entregas/pedidos asociados),
    // sugerir soft delete
    const msg = e?.message || "";
    if (msg.includes("foreign key") || msg.includes("FOREIGN")) {
      return NextResponse.json({
        error: "No se puede eliminar físicamente porque tiene entregas o pedidos asociados. Usá soft delete (?hard=false) o eliminá primero las entregas.",
      }, { status: 400 });
    }
    return NextResponse.json({ error: msg || "Error interno" }, { status: 500 });
  }
}

