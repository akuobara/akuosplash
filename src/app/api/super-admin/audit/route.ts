import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/super-admin/audit
// Lista logs de auditoría con filtros opcionales:
//   ?actor=usuarioId — filtrar por quién hizo la acción
//   ?entidad=camion — filtrar por tipo de entidad
//   ?accion=eliminar — filtrar por tipo de acción
//   ?duenoId=xxx — filtrar por admin dueño del recurso
//   ?desde=2026-09-01 — filtrar desde fecha
//   ?hasta=2026-09-30 — filtrar hasta fecha
//   ?q=texto — búsqueda full-text en descripción
//   ?limit=50 — cantidad (default 50, max 200)
//   ?offset=0 — paginación
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const actor = searchParams.get("actor");
  const entidad = searchParams.get("entidad");
  const accion = searchParams.get("accion");
  const duenoId = searchParams.get("duenoId");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const q = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Number(searchParams.get("offset") || 0);

  const where: Record<string, unknown> = {};
  if (actor) where.actorId = actor;
  if (entidad) where.entidad = entidad;
  if (accion) where.accion = accion;
  if (duenoId) where.duenoId = duenoId;
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) (where.creadoEn as any).gte = new Date(desde);
    if (hasta) (where.creadoEn as any).lte = new Date(hasta + "T23:59:59");
  }
  if (q) {
    where.OR = [
      { descripcion: { contains: q } },
      { entidadNombre: { contains: q } },
      { actorNombre: { contains: q } },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ]);

  // Stats rápidas: acciones más frecuentes y entidades más afectadas
  const statsAcciones = await db.auditLog.groupBy({
    by: ["accion"],
    _count: true,
    orderBy: { _count: { accion: "desc" } },
    take: 10,
  });

  const statsEntidades = await db.auditLog.groupBy({
    by: ["entidad"],
    _count: true,
    orderBy: { _count: { entidad: "desc" } },
    take: 10,
  });

  return NextResponse.json({
    logs,
    total,
    limit,
    offset,
    stats: {
      acciones: statsAcciones.map(s => ({ accion: s.accion, count: s._count })),
      entidades: statsEntidades.map(s => ({ entidad: s.entidad, count: s._count })),
    },
  });
}
