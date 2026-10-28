import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import {
  calcularPrecio,
  aplicarComision,
  REGLAS_DEFAULT,
  type ReglaPrecio,
  type PrecioInput,
  type TipoMetodoPago,
  type TipoUrgencia,
  VERSION_MOTOR,
} from "@/lib/precio-dinamico";

// POST /api/akuosplash/precio/preview
// Testing: el superadmin manda un PrecioInput hipotético y ve el resultado.
// No afecta nada — solo simulación.
//
// Body: PrecioInput completo (sin necesidad de cliente logueado real).
// Solo superadmin.
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }
  const body = await req.json();

  // Cargar reglas actuales del config
  const config = await akuosplashDb.akuoConfig.findFirst();
  let reglas: ReglaPrecio[] = REGLAS_DEFAULT;
  if (config?.reglasPrecioJson) {
    try {
      const parsed = JSON.parse(config.reglasPrecioJson);
      if (Array.isArray(parsed)) reglas = parsed;
    } catch {
      // fallback
    }
  }

  const input: PrecioInput = {
    litros: Number(body.litros) || 5000,
    metodoPago: (body.metodoPago || "efectivo") as TipoMetodoPago,
    urgencia: (body.urgencia || "standard") as TipoUrgencia,
    horario: body.horario ? new Date(body.horario) : new Date(),
    clienteLat: body.clienteLat ?? null,
    clienteLng: body.clienteLng ?? null,
    clienteDeuda: Number(body.clienteDeuda) || 0,
    clienteAntiguedadMeses: Number(body.clienteAntiguedadMeses) || 0,
    zonaPrecioBase: Number(body.zonaPrecioBase) || 250,
    zonaPrecioMinimoLitro: body.zonaPrecioMinimoLitro ?? null,
    zonaPrecioMinimoTotal: body.zonaPrecioMinimoTotal ?? null,
    zonaPrecioMaximoLitro: body.zonaPrecioMaximoLitro ?? null,
    depotLat: body.depotLat ?? config?.depotLat ?? null,
    depotLng: body.depotLng ?? config?.depotLng ?? null,
    demandaUltimaHora: body.demandaUltimaHora,
    climaTempC: body.climaTempC,
    capacidadCamionUsadaPct: body.capacidadCamionUsadaPct,
  };

  const resultado = calcularPrecio(input, reglas);
  const resultadoConComision = aplicarComision(resultado, config?.comisionPorcentaje ?? 0);

  return NextResponse.json({
    resultado: resultadoConComision,
    version: VERSION_MOTOR,
    input,
  });
}
