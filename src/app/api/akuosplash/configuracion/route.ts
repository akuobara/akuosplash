import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/configuracion — devuelve la configuración del transportista
// En Aljibe cada admin tiene su propia Configuracion. En AkuoSplash, usamos
// los campos del AkuoUsuario + defaults
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  return NextResponse.json({
    configuracion: {
      id: user.id,
      nombreChofer: user.nombre,
      nombreDueno: user.nombre, // el transportista es el dueño
      capacidadCamion: (user as any).capacidadVehiculoKg || 5000,
      modoLiquidacion: "porcentaje",
      porcentajeComisionChofer: 50,
      porcentajeComisionDueno: 50,
      montoPorVueltaUnicoCliente: 0,
      montoPorVueltaMultiple: 0,
      precioEfectivoPorLitro: 50,
      precioTransferenciaPorLitro: 50,
      precioCamionCompleto: 0,
      tipoTributo: "iva",
      porcentajeImpuesto: 19,
      aplicaImpuestoSobre: "ventas",
      choferesPuedenEditarClientes: true,
      choferesPuedenCrearPedidos: true,
      umbralCompletacionVuelta: 0.975,
    },
  });
}

// PATCH /api/akuosplash/configuracion — actualizar configuración
export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const body = await req.json();
  const data: any = {};
  if (body.nombreChofer !== undefined) data.nombre = body.nombreChofer;
  if (body.capacidadCamion !== undefined) data.capacidadVehiculoKg = Number(body.capacidadCamion);

  if (Object.keys(data).length > 0) {
    await akuosplashDb.akuoUsuario.update({ where: { id: user.id }, data });
  }
  return NextResponse.json({ ok: true });
}
