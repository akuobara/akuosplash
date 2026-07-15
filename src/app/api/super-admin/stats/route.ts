import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Middleware para verificar que es super_admin
async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return null;
  }
  return session;
}

// GET /api/super-admin/stats — estadísticas globales
export async function GET() {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const [administradores, choferes, clientes, camiones, entregas, vueltas, gastos, pagos] = await Promise.all([
      db.usuario.count({ where: { role: "dueno" } }),
      db.usuario.count({ where: { role: "chofer" } }),
      db.cliente.count(),
      db.camion.count(),
      db.entrega.count(),
      db.vuelta.count(),
      db.gasto.count(),
      db.pago.count(),
    ]);

    // Totales de dinero
    const ventasResult = await db.entrega.aggregate({ _sum: { total: true } });
    const efectivoResult = await db.entrega.aggregate({ _sum: { montoEfectivo: true } });
    const transferenciaResult = await db.entrega.aggregate({ _sum: { montoTransferencia: true } });
    const litrosResult = await db.entrega.aggregate({ _sum: { litros: true } });

    // Administradores con sus stats
    const admins = await db.usuario.findMany({
      where: { role: "dueno" },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        creadoEn: true,
        _count: {
          select: {
            choferes: true,
            camionesDueno: true,
            clientesDueno: true,
            vueltasComoDueno: true,
            entregasComoDueno: true,
          },
        },
      },
      orderBy: { creadoEn: "desc" },
    });

    // Stats por administrador
    const adminStats = await Promise.all(
      admins.map(async (a) => {
        const ventas = await db.entrega.aggregate({
          where: { duenoId: a.id },
          _sum: { total: true, litros: true },
        });
        return {
          ...a,
          ventasTotal: ventas._sum.total || 0,
          litrosTotal: ventas._sum.litros || 0,
        };
      })
    );

    return NextResponse.json({
      globales: {
        administradores,
        choferes,
        clientes,
        camiones,
        entregas,
        vueltas,
        gastos,
        pagos,
        ventasTotal: ventasResult._sum.total || 0,
        efectivoTotal: efectivoResult._sum.montoEfectivo || 0,
        transferenciaTotal: transferenciaResult._sum.montoTransferencia || 0,
        litrosTotal: litrosResult._sum.litros || 0,
      },
      administradores: adminStats,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
