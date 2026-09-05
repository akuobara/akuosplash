import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/auth/me
// Devuelve el usuario actual (o null si no hay sesión) + hasUsers (para saber si mostrar registro o login)
// Si ?perfil=true, devuelve también camiones asignados, stats y contacto del admin
export async function GET(req: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const conPerfil = searchParams.get("perfil") === "true";

  if (session) {
    // Verificar que el usuario siga activo en la DB
    const user = await db.usuario.findUnique({
      where: { id: session.userId },
      select: { activo: true, role: true, nombre: true, email: true, duenoId: true, telefono: true },
    });

    if (!user || !user.activo) {
      return NextResponse.json({ user: null, hasUsers: true });
    }

    if (conPerfil) {
      // Cargar camiones asignados (para choferes)
      const camionesAsignados = user.role === "chofer"
        ? await db.camionChofer.findMany({
            where: { choferId: session.userId },
            include: {
              camion: {
                select: { id: true, nombre: true, patente: true, capacidad: true, activo: true },
              },
            },
          })
        : [];
      const camiones = camionesAsignados.map((a) => a.camion);

      // Stats del chofer
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const [totalEntregas, totalLitrosAgg, totalVueltas, ventasMesAgg] = await Promise.all([
        db.entrega.count({ where: { choferId: session.userId } }),
        db.entrega.aggregate({ where: { choferId: session.userId }, _sum: { litros: true } }),
        db.vuelta.count({ where: { choferId: session.userId } }),
        db.entrega.aggregate({
          where: { choferId: session.userId, fecha: { gte: inicioMes } },
          _sum: { total: true },
        }),
      ]);

      // Contacto del dueño
      const dueno = user.duenoId
        ? await db.usuario.findUnique({
            where: { id: user.duenoId },
            select: { nombre: true, email: true, telefono: true },
          })
        : null;

      return NextResponse.json({
        user: {
          userId: session.userId,
          email: user.email,
          nombre: user.nombre,
          role: user.role,
          duenoId: user.duenoId,
        },
        hasUsers: true,
        usuario: {
          id: session.userId,
          nombre: user.nombre,
          email: user.email,
          telefono: user.telefono,
          role: user.role,
        },
        camiones,
        stats: {
          totalEntregas,
          totalLitros: totalLitrosAgg._sum.litros ?? 0,
          totalVueltas,
          ventasMes: ventasMesAgg._sum.total ?? 0,
        },
        dueno,
      });
    }

    return NextResponse.json({
      user: {
        userId: session.userId,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        duenoId: user.duenoId,
      },
      hasUsers: true,
    });
  }

  // No hay sesión: verificar si hay usuarios registrados
  const userCount = await db.usuario.count();
  return NextResponse.json({ user: null, hasUsers: userCount > 0 });
}
