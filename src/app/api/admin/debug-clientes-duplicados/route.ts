import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/admin/debug-clientes-duplicados
// Lista clientes duplicados (mismo nombre en la misma flota del dueño logueado).
// Solo accesible para usuarios autenticados (dueno o chofer).
// Devuelve los IDs de los duplicados para que el usuario pueda borrarlos manualmente.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const duenoId = session.role === "dueno" ? session.userId : session.duenoId;
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Buscar clientes con el mismo nombre (case insensitive) en la misma flota
  const clientes = await db.cliente.findMany({
    where: { duenoId },
    select: { id: true, nombre: true, direccion: true, telefono: true, duenoId: true, creadoEn: true },
    orderBy: { nombre: "asc" },
  });

  // Agrupar por nombre (normalizado: trim + lowercase)
  const grupos: Record<string, any[]> = {};
  for (const c of clientes as any[]) {
    const key = (c.nombre || "").trim().toLowerCase();
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  }

  // Filtrar solo los grupos con más de 1 cliente (duplicados)
  const duplicados = Object.entries(grupos)
    .filter(([_, lista]) => lista.length > 1)
    .map(([nombre, lista]) => ({
      nombre,
      cantidad: lista.length,
      clientes: lista.sort((a, b) => {
        const aTime = a.creadoEn instanceof Date ? a.creadoEn.getTime() : new Date(a.creadoEn).getTime();
        const bTime = b.creadoEn instanceof Date ? b.creadoEn.getTime() : new Date(b.creadoEn).getTime();
        return aTime - bTime;
      }),
    }));

  return NextResponse.json({
    sessionUserId: session.userId,
    sessionRole: session.role,
    sessionDuenoId: duenoId,
    totalClientes: clientes.length,
    gruposDuplicados: duplicados.length,
    duplicados,
  });
}
