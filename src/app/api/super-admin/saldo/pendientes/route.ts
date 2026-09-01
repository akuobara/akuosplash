import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/saldo/pendientes — lista cargas de saldo pendientes de confirmación
export async function GET() {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const pendientes = await db.movimientoSaldoClienteApp.findMany({
    where: {
      tipo: "carga",
      confirmado: false,
      metodoCarga: "transferencia",
    },
    orderBy: { creadoEn: "desc" },
    take: 200,
    select: {
      id: true,
      creadoEn: true,
      monto: true,
      metodoCarga: true,
      comprobanteUrl: true,
      descripcion: true,
      cliente: {
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          saldo: true,
        },
      },
    },
  });

  const totalPendiente = pendientes.reduce((s, m) => s + m.monto, 0);

  return NextResponse.json({
    pendientes,
    cantidad: pendientes.length,
    totalPendiente,
  });
}
