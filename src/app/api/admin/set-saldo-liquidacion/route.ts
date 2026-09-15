import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/admin/set-saldo-liquidacion
// Establece manualmente el saldo pendiente de liquidación.
// Body: { monto: 76100 }
async function ejecutar(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    let monto = 0;
    // GET: leer de query params
    const url = new URL(req.url);
    const montoParam = url.searchParams.get("monto");
    if (montoParam) {
      monto = Number(montoParam) || 0;
    }
    // POST: leer del body
    if (req.method === "POST") {
      const body = await req.json();
      monto = Number(body.monto) || 0;
    }

    const config = await db.configuracion.update({
      where: { duenoId },
      data: { saldoPendienteLiquidacion: monto },
    });

    return NextResponse.json({
      ok: true,
      saldoPendienteLiquidacion: config.saldoPendienteLiquidacion,
      message: `Saldo pendiente establecido en ${monto}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return ejecutar(req); }
export async function GET(req: NextRequest) { return ejecutar(req); }
