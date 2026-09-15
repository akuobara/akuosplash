import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/fix-cobro-saldo
// Elimina los pagos registrados incorrectamente como "Cobro de saldo de liquidación anterior"
// y los vuelve a crear como gastos del dueño.
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Buscar pagos con descripcion que contiene "saldo de liquidación anterior"
    const pagosIncorrectos = await db.pago.findMany({
      where: {
        duenoId,
        descripcion: { contains: "saldo de liquidación anterior" },
      },
      select: { id: true, monto: true, metodoPago: true, descripcion: true, fecha: true, choferId: true },
    });

    const arreglados: any[] = [];
    for (const p of pagosIncorrectos) {
      // Crear el gasto correcto
      await db.gasto.create({
        data: {
          fecha: p.fecha,
          tipo: "otro",
          descripcion: p.descripcion,
          monto: p.monto,
          pagadoPor: "dueno",
          choferId: p.choferId,
          duenoId,
        },
      });
      // Eliminar el pago incorrecto
      await db.pago.delete({ where: { id: p.id } });
      arreglados.push({
        id: p.id,
        monto: p.monto,
        metodo: p.metodoPago,
        descripcion: p.descripcion,
      });
    }

    return NextResponse.json({
      ok: true,
      eliminados: arreglados.length,
      detalle: arreglados,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST() { return ejecutar(); }
export async function GET() { return ejecutar(); }
