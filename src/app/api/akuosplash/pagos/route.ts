import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/pagos — registrar pago (sin entrega, ej: abono a deuda)
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.monto || Number(body.monto) <= 0) return NextResponse.json({ error: "Monto obligatorio" }, { status: 400 });
  const pago = await akuosplashDb.akuoPago.create({
    data: {
      transportistaId: user.id,
      monto: Number(body.monto),
      concepto: body.concepto || "Pago",
      metodoPago: body.metodoPago || "efectivo",
      estado: "confirmado",
    },
  });
  return NextResponse.json({ ok: true, pago }, { status: 201 });
}
