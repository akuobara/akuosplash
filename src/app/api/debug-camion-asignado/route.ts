import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// Endpoint temporal de diagnóstico para investigar "no tengo camión asignado"
// Eliminar después de resolver el problema.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    const duenoId = await getDuenoId();

    // Todos los usuarios del sistema (del mismo dueno)
    const usuarios = await db.usuario.findMany({
      where: duenoId ? {
        OR: [{ id: duenoId }, { duenoId }],
      } : {},
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        activo: true,
        duenoId: true,
      },
    });

    // Todos los camiones del dueno
    const camiones = await db.camion.findMany({
      where: duenoId ? { duenoId } : {},
      select: {
        id: true,
        nombre: true,
        patente: true,
        activo: true,
        duenoId: true,
      },
    });

    // Todas las asignaciones CamionChofer (con datos relacionados)
    const asignaciones = await db.camionChofer.findMany({
      include: {
        camion: { select: { id: true, nombre: true, activo: true, duenoId: true } },
        chofer: { select: { id: true, nombre: true, email: true, role: true, activo: true, duenoId: true } },
      },
    });

    // Vueltas activas
    const vueltasActivas = await db.vuelta.findMany({
      where: { activa: true },
      select: {
        id: true,
        numero: true,
        iniciadaEn: true,
        camionId: true,
        choferId: true,
        duenoId: true,
      },
    });

    // Para el usuario actual: ¿qué camiones ve?
    const camionesVisibles = session.role === "dueno"
      ? camiones
      : asignaciones
          .filter((a) => a.choferId === session.userId && a.camion.activo)
          .map((a) => a.camion);

    return Response.json({
      session: {
        userId: session.userId,
        role: session.role,
        duenoId: session.duenoId ?? null,
      },
      duenoIdEfectivo: duenoId,
      usuarios,
      camiones,
      asignaciones,
      vueltasActivas,
      camionesVisiblesParaMi: camionesVisibles,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined },
      { status: 500 }
    );
  }
}
