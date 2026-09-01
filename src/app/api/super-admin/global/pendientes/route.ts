import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/global/pendientes
// Lista TODOS los clientes con saldo pendiente, agrupados por admin
export async function GET() {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const clientes = await db.cliente.findMany({
      select: {
        id: true, nombre: true, telefono: true, zona: true, direccion: true,
        dueno: { select: { id: true, nombre: true } },
        entregas: { select: { total: true, montoRecibido: true } },
        pagos: { select: { monto: true } },
      },
    });

    const pendientes = clientes
      .map((c) => {
        const totalVentas = c.entregas.reduce((s, e) => s + e.total, 0);
        const totalRecibido = c.entregas.reduce((s, e) => s + e.montoRecibido, 0);
        const totalPagos = c.pagos.reduce((s, p) => s + p.monto, 0);
        const saldo = Math.max(0, totalVentas - totalRecibido - totalPagos);
        return {
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          zona: c.zona,
          direccion: c.direccion,
          admin: c.dueno,
          totalVentas,
          totalRecibido,
          totalPagos,
          saldo,
        };
      })
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);

    const totalPendiente = pendientes.reduce((s, c) => s + c.saldo, 0);

    return NextResponse.json({
      pendientes,
      totalPendiente,
      cantidad: pendientes.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener pendientes" }, { status: 500 });
  }
}
