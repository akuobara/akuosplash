import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/config/public — configuración pública (sin auth)
// Expone si Google Sign-In está disponible para que el frontend muestre/oculte el botón.
// También expone datos de transferencia (si los hay) para mostrarlos en la app cliente.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const withTransfer = searchParams.get("transfer") === "true";

  let transfData: any = null;
  if (withTransfer) {
    // Buscar la primera configuración (asumimos una sola por ahora)
    const config = await db.configuracion.findFirst({
      where: { transfBanco: { not: null } },
      select: {
        transfBanco: true,
        transfTipoCuenta: true,
        transfNumeroCuenta: true,
        transfTitular: true,
        transfRutTitular: true,
        transfEmail: true,
        transfTelefono: true,
      },
    });
    if (config && config.transfBanco) {
      transfData = config;
    }
  }

  return NextResponse.json({
    googleLoginEnabled: !!process.env.GOOGLE_CLIENT_ID,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    transfData,
  });
}
