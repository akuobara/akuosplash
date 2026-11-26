import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { refundTransaction } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/refund
// Anula/reembolsa una transacción Webpay Plus confirmada (server-to-server).
// Superadmin only — usado para la Prueba 7 (anulación total) de la certificación Transbank.
// Body: { tokenWs, amount }
// Devuelve: { refund } (respuesta cruda de Transbank: type, response_code, etc.)
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const body = await req.json();
  const tokenWs = body.tokenWs;
  const amount = Number(body.amount);
  if (!tokenWs) return NextResponse.json({ error: "Falta tokenWs" }, { status: 400 });
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Falta amount (debe ser > 0)" }, { status: 400 });
  }

  try {
    const refund = await refundTransaction(tokenWs, amount);
    return NextResponse.json({ refund });
  } catch (e: any) {
    console.error("[transbank refund]", e);
    return NextResponse.json({ error: e.message || "No se pudo anular la transacción" }, { status: 500 });
  }
}
