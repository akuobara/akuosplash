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

  // ─── Calcular disponibilidad y demanda en la zona del cliente ───
  // Disponibilidad = repartidores activos en la zona del cliente (o zonas cercanas)
  // Un repartidor "activo" es: rol=transportista, activo=true, aprobado=true,
  // ultimoLoginEn en las últimas 2 horas (frecuencia razonable de actividad)
  const hace2Horas = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Repartidores que están en la MISMA zona del cliente
  const repartidoresMismaZona = await akuosplashDb.akuoUsuario.count({
    where: {
      rol: "transportista",
      activo: true,
      aprobado: true,
      zonaId: zona.id,
      ultimoLoginEn: { gte: hace2Horas },
    },
  });

  // Repartidores que NO tienen zona asignada pero están GEOGRÁFICAMENTE cerca
  // (a menos de 10 km del cliente) — también cuentan como "disponibles"
  let repartidoresCercanosSinZona = 0;
  if (user.lat != null && user.lng != null) {
    // Query SQL raw porque Prisma no soporta haversine
    // Aproximación: buscar usuarios con lat/lng en un bounding box de ~10km
    // 1 grado de latitud = ~111 km, entonces 10 km = ~0.09 grados
    const lat = user.lat;
    const lng = user.lng;
    const delta = 0.09;
    const cercanos = await akuosplashDb.akuoUsuario.findMany({
      where: {
        rol: "transportista",
        activo: true,
        aprobado: true,
        ultimoLoginEn: { gte: hace2Horas },
        // Solo los que NO están en la misma zona (ya contados arriba)
        OR: [
          { zonaId: null },
          { zonaId: { not: zona.id } },
        ],
        lat: { gte: lat - delta, lte: lat + delta },
        lng: { gte: lng - delta, lte: lng + delta },
      },
      select: { id: true, lat: true, lng: true },
    });
    // Para cada candidato, verificar con Haversine que esté realmente < 10 km
    // (bounding box es una aproximación, el rectángulo contiene puntos que pueden estar más lejos)
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // km
    for (const r of cercanos) {
      if (r.lat == null || r.lng == null) continue;
      const dLat = toRad(r.lat - lat);
      const dLng = toRad(r.lng - lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(r.lat)) * Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distancia = R * c;
      if (distancia <= 10) {
        repartidoresCercanosSinZona++;
      }
    }
  }

  const disponibilidadZona = repartidoresMismaZona + repartidoresCercanosSinZona;

  // Demanda = pedidos creados en la zona del cliente en la última hora
  // (pedidos pendientes o ya aceptados — los cancelados no cuentan)
  const hace1Hora = new Date(Date.now() - 60 * 60 * 1000);
  const demandaUltimaHora = await akuosplashDb.akuoPedidoCliente.count({
    where: {
      creadoEn: { gte: hace1Hora },
      estado: { in: ["pendiente", "aceptado", "en_ruta"] },
      cliente: { zonaId: zona.id },
    },
  });

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
    // Depot (opcional — solo si la regla distancia está activa, que no lo está por defecto)
    depotLat: config.depotLat ?? null,
    depotLng: config.depotLng ?? null,
    // Mercado (fase 2)
    disponibilidadZona,
    demandaUltimaHora,
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
    // Datos de mercado (para debug / transparencia)
    mercado: {
      disponibilidadZona,
      repartidoresMismaZona,
      repartidoresCercanosSinZona,
      demandaUltimaHora,
      ratio: disponibilidadZona > 0 ? (demandaUltimaHora / disponibilidadZona).toFixed(2) : null,
    },
    config: {
      comisionPct: config.comisionPorcentaje,
      depotNombre: config.depotNombre,
      precioDinamicoHabilitado: config.precioDinamicoHabilitado,
    },
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
