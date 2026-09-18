import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/fix-gasto-pagado-por
//
// Lista los gastos del último mes con pagadoPor="chofer" para que el usuario
// pueda ver cuáles están mal y corregirlos individualmente.
//
// Query params:
//   ?tipo=combustible_camion  → filtrar por tipo
//   ?corregir=ID              → cambiar pagadoPor a "dueno" para ese gasto
//   ?corregirTodos=1          → cambiar todos los del último mes a "dueno"
async function ejecutar(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipoFiltro = searchParams.get("tipo");
  const corregirId = searchParams.get("corregir");
  const corregirTodos = searchParams.get("corregirTodos") === "1";

  // Modo corrección individual
  if (corregirId) {
    const gasto = await db.gasto.findUnique({ where: { id: corregirId } });
    if (!gasto || gasto.duenoId !== duenoId) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }
    const actualizado = await db.gasto.update({
      where: { id: corregirId },
      data: { pagadoPor: "dueno" },
    });
    return NextResponse.json({
      ok: true,
      gasto: actualizado,
      message: `Gasto ${corregirId} cambiado a pagadoPor="dueno"`,
    });
  }

  // Modo corrección masiva
  if (corregirTodos) {
    const haceUnMes = new Date();
    haceUnMes.setDate(haceUnMes.getDate() - 30);
    const where: any = {
      duenoId,
      pagadoPor: "chofer",
      fecha: { gte: haceUnMes },
    };
    if (tipoFiltro) where.tipo = tipoFiltro;
    const resultado = await db.gasto.updateMany({
      where,
      data: { pagadoPor: "dueno" },
    });
    return NextResponse.json({
      ok: true,
      actualizados: resultado.count,
      message: `${resultado.count} gastos cambiados a pagadoPor="dueno"`,
    });
  }

  // Modo diagnóstico: listar
  const haceUnMes = new Date();
  haceUnMes.setDate(haceUnMes.getDate() - 30);
  const where: any = {
    duenoId,
    pagadoPor: "chofer",
    fecha: { gte: haceUnMes },
  };
  if (tipoFiltro) where.tipo = tipoFiltro;
  const gastos = await db.gasto.findMany({
    where,
    select: { id: true, fecha: true, monto: true, tipo: true, descripcion: true, pagadoPor: true, choferId: true },
    orderBy: { fecha: "desc" },
  });
  return NextResponse.json({
    total: gastos.length,
    gastos: gastos.map((g) => ({
      ...g,
      fecha: String(g.fecha),
      urlCorregir: `/api/admin/fix-gasto-pagado-por?corregir=${g.id}`,
    })),
    sugerencia: "Para corregir uno: GET /api/admin/fix-gasto-pagado-por?corregir=ID. Para corregir todos: ?corregirTodos=1 (opcional &tipo=combustible_camion)",
  });
}

export async function GET(req: NextRequest) { return ejecutar(req); }
export async function POST(req: NextRequest) { return ejecutar(req); }
