import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";
import { clearCierreCache } from "@/lib/periodo-cerrado";

// POST /api/liquidacion/cerrar
// Cierra el período actual, registrando la fecha de cierre.
// Solo el dueño puede cerrar períodos.
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo el dueño puede cerrar períodos
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo el administrador puede cerrar períodos" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const fechaCierre = body.fechaCierre ? new Date(body.fechaCierre) : new Date();

  // Actualizar ultimoCierre en la configuración
  const config = await db.configuracion.update({
    where: { duenoId },
    data: { ultimoCierre: fechaCierre },
  });

  // Limpiar cache para que los endpoints de escritura bloqueen inmediatamente
  clearCierreCache();

  return NextResponse.json({
    ok: true,
    ultimoCierre: config.ultimoCierre,
    message: `Período cerrado el ${fechaCierre.toLocaleDateString("es-CL")}. Las entregas, gastos y pagos de este período ya no se pueden editar.`,
  });
}
