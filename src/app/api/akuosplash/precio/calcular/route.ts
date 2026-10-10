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

// POST /api/akuosplash/precio/calcular
// Recibe el input del pedido candidato + datos del cliente logueado.
// Devuelve el precio total + desglose + validez 5 min.
//
// Body:
// {
//   litros: number,
//   metodoPago: "efectivo" | "transferencia" | "credito" | "tarjeta",
//   urgencia: "standard" | "express" | "emergency",
//   horario: string (ISO date),
// }
//
// El cliente se saca del session. La zona se determina por cliente.zonaId.
// Las reglas se sacan de AkuoConfig.reglasPrecioJson (o REGLAS_DEFAULT si no hay).
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente") {
    return NextResponse.json({ error: "Solo clientes pueden calcular precio" }, { status: 403 });
  }

  const body = await req.json();
  const litros = Number(body.litros);
  const metodoPago = (body.metodoPago || "efectivo") as TipoMetodoPago;
  const urgencia = (body.urgencia || "standard") as TipoUrgencia;
  const horarioStr = body.horario;
  if (!litros || litros <= 0) {
    return NextResponse.json({ error: "Litros inválidos" }, { status: 400 });
  }
  let horario: Date;
  try {
    horario = horarioStr ? new Date(horarioStr) : new Date();
    if (isNaN(horario.getTime())) horario = new Date();
  } catch {
    horario = new Date();
  }

  // Cargar config + reglas
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) {
    return NextResponse.json({ error: "Config no encontrada" }, { status: 500 });
  }
  if (!config.precioDinamicoHabilitado) {
    return NextResponse.json({
      error: "Precio dinámico no habilitado",
      hint: "Usar el precio estático de la zona del cliente",
    }, { status: 400 });
  }
  let reglas: ReglaPrecio[] = REGLAS_DEFAULT;
  try {
    if (config.reglasPrecioJson) {
      const parsed = JSON.parse(config.reglasPrecioJson);
      if (Array.isArray(parsed)) reglas = parsed;
    }
  } catch {
    // fallback a defaults
  }

  // Zona del cliente
  let zona: any = null;
  if (user.zonaId) {
    zona = await akuosplashDb.akuoZona.findUnique({ where: { id: user.zonaId } });
  }
  if (!zona) {
    // Si el cliente no tiene zona, no podemos calcular precio dinámico
    return NextResponse.json({
      error: "Cliente sin zona asignada",
      hint: "El cliente debe tener una zona con precio configurado",
    }, { status: 400 });
  }

  // Antigüedad del cliente
  const creadoEn = user.creadoEn instanceof Date ? user.creadoEn : new Date(user.creadoEn);
  const antiguedadMeses = Math.max(0, (Date.now() - creadoEn.getTime()) / (1000 * 60 * 60 * 24 * 30));

  // Calcular deuda del cliente (sumar pedidos pendientes de pago con saldo)
  // Para simplificar fase 1, usar 0 — fase 2 podemos sumar pedidos con estadoPago != pagado
  const deuda = 0;

  const input: PrecioInput = {
    litros,
    metodoPago,
    urgencia,
    horario,
    clienteLat: user.lat ?? null,
    clienteLng: user.lng ?? null,
    clienteDeuda: deuda,
    clienteAntiguedadMeses: antiguedadMeses,
    zonaPrecioBase: zona.precioPorLitro,
    zonaPrecioMinimoLitro: zona.precioMinimoPorLitro ?? null,
    zonaPrecioMinimoTotal: zona.precioMinimoTotal ?? null,
    zonaPrecioMaximoLitro: zona.precioMaximoPorLitro ?? null,
    depotLat: config.depotLat ?? null,
    depotLng: config.depotLng ?? null,
  };

  const resultado = calcularPrecio(input, reglas);
  const resultadoConComision = aplicarComision(resultado, config.comisionPorcentaje);

  // Validez 5 minutos
  const validoHasta = new Date(Date.now() + 5 * 60 * 1000);

  return NextResponse.json({
    resultado: resultadoConComision,
    version: VERSION_MOTOR,
    validoHasta: validoHasta.toISOString(),
    zona: { id: zona.id, nombre: zona.nombre, precioPorLitro: zona.precioPorLitro },
    config: {
      comisionPct: config.comisionPorcentaje,
      depotNombre: config.depotNombre,
      precioDinamicoHabilitado: config.precioDinamicoHabilitado,
    },
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
