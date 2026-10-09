import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/vehiculos/[id]/verificar — superadmin verifica documentos del vehículo
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  const veh = await akuosplashDb.akuoVehiculo.findUnique({ where: { id } });
  if (!veh) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const actualizado = await akuosplashDb.akuoVehiculo.update({
    where: { id },
    data: {
      documentosVerificados: true,
      verificadoEn: new Date(),
      verificadoPor: user.id,
    },
  });

  await akuoNotificar(
    veh.transportistaId,
    "vehiculo_verificado",
    "Vehículo verificado",
    `Tu vehículo patente ${veh.patente} fue verificado y aprobado.`,
    "/akuosplash/transportista",
  );

  return NextResponse.json({ ok: true });
}
