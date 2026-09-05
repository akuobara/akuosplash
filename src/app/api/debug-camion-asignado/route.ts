import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { NextRequest } from "next/server";

// Endpoint temporal de diagnóstico para investigar "no tengo camión asignado".
// Acceso: ?token=aljibe-debug-2026 (secreto simple para que el usuario pueda verlo).
// Eliminar después de resolver el problema.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // Si no hay token correcto, requerir autenticación normal
  if (token !== "aljibe-debug-2026") {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "No autenticado. Usar ?token=aljibe-debug-2026" }, { status: 401 });
    }
  }

  try {
    const session = token === "aljibe-debug-2026" ? null : await getSession();

    // Si hay sesión, filtrar por duenoId; si no, traer todo (modo debug)
    let duenoIdFilter: string | null = null;
    if (session) {
      duenoIdFilter = await getDuenoId();
    }

    // Todos los usuarios del sistema
    const usuarios = await db.usuario.findMany({
      where: duenoIdFilter ? {
        OR: [{ id: duenoIdFilter }, { duenoId: duenoIdFilter }],
      } : {},
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        activo: true,
        duenoId: true,
        creadoEn: true,
      },
    });

    // Todos los camiones
    const camiones = await db.camion.findMany({
      where: duenoIdFilter ? { duenoId: duenoIdFilter } : {},
      select: {
        id: true,
        nombre: true,
        patente: true,
        activo: true,
        duenoId: true,
        creadoEn: true,
      },
    });

    // Todas las asignaciones CamionChofer
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
      orderBy: { iniciadaEn: "desc" },
    });

    // Para cada usuario chofer, simular qué vería
    const choferes = usuarios.filter((u) => u.role === "chofer");
    const diagnosticoPorChofer = choferes.map((ch) => {
      const asignacionesDelChofer = asignaciones.filter((a) => a.choferId === ch.id);
      const camionesAsignados = asignacionesDelChofer
        .map((a) => a.camion)
        .filter((c) => c && c.activo);
      const vueltasActivasDelChofer = vueltasActivas.filter((v) => v.choferId === ch.id);
      const vueltaConCamion = vueltasActivasDelChofer.find((v) => v.camionId);

      let diagnostico: string;
      if (camionesAsignados.length > 0) {
        diagnostico = "OK — chofer ve camiones asignados";
      } else if (asignacionesDelChofer.length > 0) {
        diagnostico = "PROBLEMA — chofer tiene CamionChofer PERO camion.activo=false. El camión fue desactivado.";
      } else if (vueltaConCamion) {
        diagnostico = "PROBLEMA — CamionChofer vacío PERO hay vuelta activa con camión. Se borraron las asignaciones.";
      } else {
        diagnostico = "OK — chofer sin asignaciones ni vueltas (no necesita camión)";
      }

      return {
        choferId: ch.id,
        choferNombre: ch.nombre,
        choferEmail: ch.email,
        choferActivo: ch.activo,
        asignacionesCount: asignacionesDelChofer.length,
        camionesAsignadosVisibles: camionesAsignados.length,
        vueltasActivas: vueltasActivasDelChofer.length,
        vueltaConCamion: !!vueltaConCamion,
        diagnostico,
        detalleAsignaciones: asignacionesDelChofer.map((a) => ({
          camionId: a.camionId,
          camionNombre: a.camion?.nombre,
          camionActivo: a.camion?.activo,
          asignadoEn: a.asignadoEn,
        })),
        detalleVueltasActivas: vueltasActivasDelChofer.map((v) => ({
          vueltaId: v.id,
          numero: v.numero,
          camionId: v.camionId,
          iniciadaEn: v.iniciadaEn,
        })),
      };
    });

    return Response.json({
      timestamp: new Date().toISOString(),
      sessionInfo: session ? {
        userId: session.userId,
        role: session.role,
      } : { mode: "debug-token (sin sesión)" },
      duenoIdFilter,
      counts: {
        usuarios: usuarios.length,
        camiones: camiones.length,
        asignaciones: asignaciones.length,
        vueltasActivas: vueltasActivas.length,
      },
      usuarios,
      camiones,
      asignaciones,
      vueltasActivas,
      diagnosticoPorChofer,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined },
      { status: 500 }
    );
  }
}
