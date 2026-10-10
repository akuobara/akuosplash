/**
 * Motor de precio dinámico para AkuoSplash marketplace.
 *
 * Función pura `calcularPrecio(input, reglas)` que recibe los datos del pedido
 * + cliente + zona + reglas configuradas por el superadmin, y devuelve el
 * precio total + desglose completo + flags de floor/cap aplicados.
 *
 * El snapshot del resultado se persiste en AkuoPedidoCliente.precioSnapshotJson
 * al confirmar el pedido, para que el precio no cambie después.
 *
 * Factores soportados (fase 1):
 * - base: precioPorLitro de la zona × litros
 * - volumen: descuento por escalones de litros
 * - metodo_pago: ajuste por método (efectivo/transferencia/credito/tarjeta)
 * - urgencia: surcharge por entrega express/emergency
 * - horario: peak/valle/noche
 * - dia_semana: fin de semana
 * - distancia: costo por km extra desde el depot de la plataforma (DESACTIVADA por defecto)
 * - historial_pago: surcharge si cliente moroso
 * - frecuencia: descuento por cliente con antigüedad
 *
 * Factores de mercado (fase 2 — principales según feedback):
 * - disponibilidad_zona: surge/discount según cantidad de repartidores activos en la zona (o cercanas)
 * - demanda_oferta: surge si demanda > oferta (ratio > umbral), con cap
 *
 * Factores pendientes (fase 3):
 * - demanda: surge por pedidos en última hora (necesita cache de demanda)
 * - clima: surge por ola de calor (necesita integración Open-Meteo)
 * - capacidad: surge si camión está casi lleno
 *
 * Límites:
 * - precioMinimoPorLitro (floor por litro de la zona)
 * - precioMinimoTotal (floor por viaje de la zona)
 * - precioMaximoPorLitro (cap de la zona, anti-surge abusivo)
 */

export type TipoRegla =
  | "base"
  | "volumen"
  | "metodo_pago"
  | "urgencia"
  | "horario"
  | "dia_semana"
  | "distancia"
  | "historial_pago"
  | "frecuencia"
  | "disponibilidad_zona"
  | "demanda_oferta"
  | "demanda"
  | "clima"
  | "capacidad";

export type TipoMetodoPago = "efectivo" | "transferencia" | "credito" | "tarjeta";
export type TipoUrgencia = "standard" | "express" | "emergency";

export interface ReglaPrecio {
  id: string;
  tipo: TipoRegla;
  enabled: boolean;
  prioridad: number; // orden de aplicación (1 = primero)
  parametros: any;
}

export interface PrecioInput {
  litros: number;
  metodoPago: TipoMetodoPago;
  urgencia: TipoUrgencia;
  horario: Date; // cuándo se quiere la entrega
  // Datos del cliente
  clienteLat: number | null;
  clienteLng: number | null;
  clienteDeuda: number;
  clienteAntiguedadMeses: number;
  // Datos de la zona
  zonaPrecioBase: number; // precioPorLitro
  zonaPrecioMinimoLitro?: number | null;
  zonaPrecioMinimoTotal?: number | null;
  zonaPrecioMaximoLitro?: number | null;
  // Datos del depot (plataforma) — opcional, no usado por defecto
  depotLat?: number | null;
  depotLng?: number | null;
  // Mercado (fase 2 — reglas principales según feedback del usuario)
  disponibilidadZona?: number; // cantidad de repartidores activos en la zona del cliente (o cercanas)
  demandaUltimaHora?: number; // cantidad de pedidos creados en la última hora en la zona del cliente
  // Fase 3 (opcional)
  climaTempC?: number;
  capacidadCamionUsadaPct?: number;
}

export type TipoItemBreakdown = "base" | "ajuste" | "descuento" | "floor" | "cap";

export interface ItemBreakdown {
  concepto: string;
  monto: number; // absoluto (siempre positivo)
  tipo: TipoItemBreakdown;
  signo: "+" | "-";
  reglaId?: string;
}

export interface PrecioResultado {
  precioBase: number; // zonaPrecioBase × litros (sin ajustes)
  precioPorLitroBase: number; // zonaPrecioBase
  precioPorLitroFinal: number; // después de todos los ajustes, floor y cap
  total: number; // precioPorLitroFinal × litros
  subtotal: number; // antes de floor/cap
  subtotalPorLitro: number; // antes de floor/cap
  iva: number; // 19% del total (Chile)
  totalConIva: number; // total + IVA (lo que paga el cliente)
  // Para el repartidor
  netoSinIva: number; // = total (porque total ya es sin IVA en Chile)
  comision: number; // comisión de la plataforma sobre el neto
  gananciaRepartidor: number; // netoSinIva - comisión
  // Detalle
  breakdown: ItemBreakdown[];
  reglasAplicadas: string[]; // ids
  floorAplicado: boolean;
  capAplicado: boolean;
  advertencias: string[];
}

// IVA en Chile = 19%
const IVA_PCT = 0.19;

// Distancia Haversine en km (pura, sin Google API)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helpers de tiempo
function getTipoHorario(fecha: Date): "valle" | "peak" | "noche" | "normal" {
  const h = fecha.getHours();
  if (h >= 22 || h < 6) return "noche";
  if (h >= 18 && h < 22) return "peak";
  if (h >= 10 && h < 16) return "valle";
  return "normal";
}

function getTipoDiaSemana(fecha: Date): "weekday" | "sabado" | "domingo" {
  const d = fecha.getDay(); // 0 = domingo
  if (d === 0) return "domingo";
  if (d === 6) return "sabado";
  return "weekday";
}

/**
 * Motor de cálculo. Función pura — no toca DB ni APIs.
 *
 * Orden de aplicación:
 * 1. Base = zonaPrecioBase × litros
 * 2. Aplicar reglas ordenadas por prioridad (descuentos y surcharges)
 * 3. Calcular precioPorLitroSubtotal = subtotal / litros
 * 4. Aplicar floor (precioMinimoPorLitro) → si subtotal < floor*litros, subir
 * 5. Aplicar cap (precioMaximoPorLitro) → si subtotal > cap*litros, bajar
 * 6. Calcular IVA, comisión, ganancia repartidor
 *
 * Notas:
 * - Los descuentos/surcharges se aplican al subtotal en pesos, no al por-litro
 * - Los floor/cap se aplican al por-litro
 */
export function calcularPrecio(input: PrecioInput, reglas: ReglaPrecio[]): PrecioResultado {
  const litros = Math.max(0, input.litros);
  const precioPorLitroBase = Math.max(0, input.zonaPrecioBase);
  const base = precioPorLitroBase * litros;

  const breakdown: ItemBreakdown[] = [];
  const reglasAplicadas: string[] = [];
  const advertencias: string[] = [];

  breakdown.push({
    concepto: `Base: $${precioPorLitroBase}/L × ${litros} L`,
    monto: base,
    tipo: "base",
    signo: "+",
  });

  // Subtotal acumulador: arranca en base, le restamos/sumamos los ajustes
  let subtotal = base;
  let subtotalPorLitro = precioPorLitroBase;

  // Ordenar reglas habilitadas por prioridad
  const reglasActivas = reglas
    .filter((r) => r.enabled)
    .sort((a, b) => a.prioridad - b.prioridad);

  for (const regla of reglasActivas) {
    if (regla.tipo === "base") continue; // ya aplicado
    const resultado = aplicarRegla(regla, input, subtotal, subtotalPorLitro, litros);
    if (!resultado) continue;
    subtotal += resultado.delta;
    subtotalPorLitro = litros > 0 ? subtotal / litros : subtotalPorLitro;
    breakdown.push({
      concepto: resultado.concepto,
      monto: Math.abs(resultado.delta),
      tipo: resultado.tipo,
      signo: resultado.delta >= 0 ? "+" : "-",
      reglaId: regla.id,
    });
    reglasAplicadas.push(regla.id);
  }

  // ─── Floor (precio mínimo por litro de la zona) ───
  let floorAplicado = false;
  if (input.zonaPrecioMinimoLitro != null && input.zonaPrecioMinimoLitro > 0) {
    if (subtotalPorLitro < input.zonaPrecioMinimoLitro) {
      const nuevoSubtotal = input.zonaPrecioMinimoLitro * litros;
      const delta = nuevoSubtotal - subtotal;
      breakdown.push({
        concepto: `Floor zona: $${input.zonaPrecioMinimoLitro}/L mínimo`,
        monto: Math.abs(delta),
        tipo: "floor",
        signo: delta >= 0 ? "+" : "-",
        reglaId: "zona_floor",
      });
      subtotal = nuevoSubtotal;
      subtotalPorLitro = input.zonaPrecioMinimoLitro;
      floorAplicado = true;
      reglasAplicadas.push("zona_floor");
    }
  }

  // ─── Floor total (precio mínimo por viaje) ───
  if (input.zonaPrecioMinimoTotal != null && input.zonaPrecioMinimoTotal > 0) {
    if (subtotal < input.zonaPrecioMinimoTotal) {
      const delta = input.zonaPrecioMinimoTotal - subtotal;
      breakdown.push({
        concepto: `Floor mínimo por viaje: $${input.zonaPrecioMinimoTotal}`,
        monto: Math.abs(delta),
        tipo: "floor",
        signo: delta >= 0 ? "+" : "-",
        reglaId: "zona_floor_total",
      });
      subtotal = input.zonaPrecioMinimoTotal;
      subtotalPorLitro = litros > 0 ? subtotal / litros : subtotal;
      floorAplicado = true;
      reglasAplicadas.push("zona_floor_total");
    }
  }

  // ─── Cap (precio máximo por litro, anti-surge) ───
  let capAplicado = false;
  if (input.zonaPrecioMaximoLitro != null && input.zonaPrecioMaximoLitro > 0) {
    if (subtotalPorLitro > input.zonaPrecioMaximoLitro) {
      const nuevoSubtotal = input.zonaPrecioMaximoLitro * litros;
      const delta = nuevoSubtotal - subtotal;
      breakdown.push({
        concepto: `Cap zona: $${input.zonaPrecioMaximoLitro}/L máximo`,
        monto: Math.abs(delta),
        tipo: "cap",
        signo: delta >= 0 ? "+" : "-",
        reglaId: "zona_cap",
      });
      subtotal = nuevoSubtotal;
      subtotalPorLitro = input.zonaPrecioMaximoLitro;
      capAplicado = true;
      reglasAplicadas.push("zona_cap");
    }
  }

  // ─── Cálculo final ───
  const total = Math.round(subtotal);
  const precioPorLitroFinal = litros > 0 ? total / litros : 0;
  const iva = Math.round(total * IVA_PCT);
  const totalConIva = total + iva;

  // Validaciones
  if (litros === 0) {
    advertencias.push("El pedido tiene 0 litros.");
  }
  if (precioPorLitroBase === 0) {
    advertencias.push("La zona no tiene precio por litro configurado.");
  }

  return {
    precioBase: base,
    precioPorLitroBase,
    precioPorLitroFinal,
    total,
    subtotal,
    subtotalPorLitro,
    iva,
    totalConIva,
    netoSinIva: total,
    comision: 0, // se calcula en el endpoint con la comisión real del config
    gananciaRepartidor: 0, // idem
    breakdown,
    reglasAplicadas,
    floorAplicado,
    capAplicado,
    advertencias,
  };
}

/**
 * Aplica una regla individual. Devuelve { delta, concepto, tipo } o null si no aplica.
 *
 * El `delta` es positivo (surcharge) o negativo (descuento).
 */
function aplicarRegla(
  regla: ReglaPrecio,
  input: PrecioInput,
  subtotalActual: number,
  _precioPorLitroActual: number,
  litros: number
): { delta: number; concepto: string; tipo: "ajuste" | "descuento" } | null {
  switch (regla.tipo) {
    case "volumen": {
      const params = regla.parametros as {
        escalones: { min: number; descuentoPct: number }[];
      };
      if (!params?.escalones) return null;
      // Tomar el escalón más alto aplicable
      const escalonAplicable = [...params.escalones]
        .sort((a, b) => b.min - a.min)
        .find((e) => litros >= e.min);
      if (!escalonAplicable) return null;
      const descuento = (subtotalActual * escalonAplicable.descuentoPct) / 100;
      return {
        delta: -descuento,
        concepto: `Volumen ≥${escalonAplicable.min}L: -${escalonAplicable.descuentoPct}%`,
        tipo: "descuento",
      };
    }

    case "metodo_pago": {
      const params = regla.parametros as Record<TipoMetodoPago, number>;
      const ajustePct = params?.[input.metodoPago];
      if (ajustePct === undefined || ajustePct === 0) return null;
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `Pago ${input.metodoPago}: ${ajustePct > 0 ? "+" : ""}${ajustePct}%`,
        tipo: ajustePct > 0 ? "ajuste" : "descuento",
      };
    }

    case "urgencia": {
      const params = regla.parametros as Record<TipoUrgencia, number>;
      const ajustePct = params?.[input.urgencia];
      if (ajustePct === undefined || ajustePct === 0) return null;
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `Urgencia ${input.urgencia}: ${ajustePct > 0 ? "+" : ""}${ajustePct}%`,
        tipo: "ajuste",
      };
    }

    case "horario": {
      const params = regla.parametros as {
        valle?: { desde: string; hasta: string; ajuste: number };
        peak?: { desde: string; hasta: string; ajuste: number };
        noche?: { desde: string; hasta: string; ajuste: number };
      };
      const tipoHorario = getTipoHorario(input.horario);
      const config = params?.[tipoHorario];
      if (!config) return null;
      const ajustePct = config.ajuste;
      if (ajustePct === 0) return null;
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `Horario ${tipoHorario} (${config.desde}-${config.hasta}): ${ajustePct > 0 ? "+" : ""}${ajustePct}%`,
        tipo: ajustePct > 0 ? "ajuste" : "descuento",
      };
    }

    case "dia_semana": {
      const params = regla.parametros as { sabado?: number; domingo?: number };
      const dia = getTipoDiaSemana(input.horario);
      const ajustePct = dia === "sabado" ? params?.sabado : dia === "domingo" ? params?.domingo : undefined;
      if (ajustePct === undefined || ajustePct === 0) return null;
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `${dia === "sabado" ? "Sábado" : "Domingo"}: ${ajustePct > 0 ? "+" : ""}${ajustePct}%`,
        tipo: "ajuste",
      };
    }

    case "distancia": {
      const params = regla.parametros as {
        radioBaseKm: number;
        costoPorKmExtra: number;
      };
      if (!params) return null;
      if (input.clienteLat == null || input.clienteLng == null || input.depotLat == null || input.depotLng == null) {
        return null; // no se puede calcular distancia
      }
      const distancia = haversineKm(input.depotLat, input.depotLng, input.clienteLat, input.clienteLng);
      const kmExtra = Math.max(0, distancia - params.radioBaseKm);
      if (kmExtra === 0) return null;
      const delta = kmExtra * params.costoPorKmExtra;
      return {
        delta,
        concepto: `Distancia ${distancia.toFixed(1)} km (+${kmExtra.toFixed(1)} km extra × $${params.costoPorKmExtra})`,
        tipo: "ajuste",
      };
    }

    case "historial_pago": {
      const params = regla.parametros as { moroso?: number; umbralDeuda?: number };
      if (!params?.moroso || !params.umbralDeuda) return null;
      if (input.clienteDeuda < params.umbralDeuda) return null;
      const delta = (subtotalActual * params.moroso) / 100;
      return {
        delta,
        concepto: `Cliente moroso (deuda $${input.clienteDeuda}): +${params.moroso}%`,
        tipo: "ajuste",
      };
    }

    case "frecuencia": {
      const params = regla.parametros as { premium_meses_min: number; ajuste: number };
      if (!params?.premium_meses_min) return null;
      if (input.clienteAntiguedadMeses < params.premium_meses_min) return null;
      const ajustePct = params.ajuste;
      if (ajustePct === 0) return null;
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `Cliente premium (${input.clienteAntiguedadMeses}m ant.): ${ajustePct > 0 ? "+" : ""}${ajustePct}%`,
        tipo: ajustePct > 0 ? "ajuste" : "descuento",
      };
    }

    // ─── Fase 2: reglas de mercado (disponibilidad + demanda/oferta) ───
    case "disponibilidad_zona": {
      const params = regla.parametros as {
        umbrales: { minRepartidores: number; maxRepartidores: number; ajustePct: number }[];
      };
      if (!params?.umbrales) return null;
      const disp = input.disponibilidadZona ?? 0;
      // Tomar el primer umbral que aplique (ordenados por minRepartidores asc)
      const umbrelAplicable = [...params.umbrales]
        .sort((a, b) => a.minRepartidores - b.minRepartidores)
        .find((u) => disp >= u.minRepartidores && disp <= u.maxRepartidores);
      if (!umbrelAplicable || umbrelAplicable.ajustePct === 0) return null;
      const delta = (subtotalActual * umbrelAplicable.ajustePct) / 100;
      const signo = umbrelAplicable.ajustePct > 0 ? "+" : "";
      return {
        delta,
        concepto: `Disponibilidad zona (${disp} repartidores): ${signo}${umbrelAplicable.ajustePct}%`,
        tipo: umbrelAplicable.ajustePct > 0 ? "ajuste" : "descuento",
      };
    }

    case "demanda_oferta": {
      const params = regla.parametros as {
        umbral_ratio: number; // ratio crítico (ej: 1.5)
        ajuste_pct_base: number; // ajuste por cada unidad de exceso
        max_ajuste_pct: number;
      };
      if (!params) return null;
      const demanda = input.demandaUltimaHora ?? 0;
      const oferta = input.disponibilidadZona ?? 0;
      // Caso 1: sin oferta (no hay repartidores en la zona) → surge máximo
      if (oferta === 0) {
        const delta = (subtotalActual * params.max_ajuste_pct) / 100;
        return {
          delta,
          concepto: `Sin repartidores disponibles en zona: +${params.max_ajuste_pct}% (surge máximo)`,
          tipo: "ajuste",
        };
      }
      // Caso 2: oferta ≥ demanda → no surge
      if (demanda <= oferta) return null;
      // Caso 3: demanda > oferta → surge proporcional al ratio (con cap)
      const ratio = demanda / oferta;
      if (ratio < params.umbral_ratio) return null;
      const exceso = ratio - 1;
      const ajustePct = Math.min(
        params.max_ajuste_pct,
        params.ajuste_pct_base * exceso
      );
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `Demanda/oferta (D:${demanda}/O:${oferta}, ratio ${ratio.toFixed(1)}): +${ajustePct.toFixed(1)}%`,
        tipo: "ajuste",
      };
    }

    // ─── Fase 3 (reglas avanzadas) ───
    case "demanda": {
      const params = regla.parametros as {
        umbral_pedidos_hora: number;
        ajuste_pct: number;
        max_ajuste_pct?: number;
      };
      if (!params) return null;
      const demanda = input.demandaUltimaHora ?? 0;
      if (demanda < params.umbral_pedidos_hora) return null;
      // Surge proporcional: cuanto más alta la demanda, mayor el ajuste (con cap)
      const exceso = demanda - params.umbral_pedidos_hora;
      const ajustePctBase = params.ajuste_pct;
      const ajustePct = params.max_ajuste_pct
        ? Math.min(params.max_ajuste_pct, ajustePctBase + exceso * 0.5)
        : ajustePctBase + exceso * 0.5;
      const delta = (subtotalActual * ajustePct) / 100;
      return {
        delta,
        concepto: `Surge demanda (${demanda} ped/hora): +${ajustePct.toFixed(1)}%`,
        tipo: "ajuste",
      };
    }

    case "clima": {
      const params = regla.parametros as {
        temp_threshold_c: number;
        dias_consecutivos: number;
        ajuste_pct: number;
      };
      if (!params) return null;
      if (input.climaTempC == null || input.climaTempC < params.temp_threshold_c) return null;
      // Asumimos que dias_consecutivos se cumple (la cron job solo setea el flag si se cumple)
      const delta = (subtotalActual * params.ajuste_pct) / 100;
      return {
        delta,
        concepto: `Ola de calor (${input.climaTempC}°C ≥ ${params.temp_threshold_c}°C): +${params.ajuste_pct}%`,
        tipo: "ajuste",
      };
    }

    case "capacidad": {
      const params = regla.parametros as { umbral_pct: number; ajuste_pct: number };
      if (!params) return null;
      if (input.capacidadCamionUsadaPct == null || input.capacidadCamionUsadaPct < params.umbral_pct) return null;
      const delta = (subtotalActual * params.ajuste_pct) / 100;
      return {
        delta,
        concepto: `Escasez capacidad camión (${input.capacidadCamionUsadaPct}% usado): +${params.ajuste_pct}%`,
        tipo: "ajuste",
      };
    }

    default:
      return null;
  }
}

/**
 * Aplica la comisión de la plataforma al resultado.
 * Comisión = porcentaje del neto sin IVA (según AkuoConfig.comisionPorcentaje).
 *
 * Mutación pura: devuelve un NUEVO resultado con comisión calculada.
 */
export function aplicarComision(
  resultado: PrecioResultado,
  comisionPct: number
): PrecioResultado {
  const comision = Math.round((resultado.netoSinIva * comisionPct) / 100);
  return {
    ...resultado,
    comision,
    gananciaRepartidor: resultado.netoSinIva - comision,
  };
}

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers de formato                                                  */
/* ──────────────────────────────────────────────────────────────────── */

export function formatMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function formatPorLitro(n: number): string {
  return "$" + n.toLocaleString("es-CL", { maximumFractionDigits: 0 }) + "/L";
}

/* ──────────────────────────────────────────────────────────────────── */
/* Reglas por defecto (defaults al activar el sistema)                  */
/* ──────────────────────────────────────────────────────────────────── */

export const REGLAS_DEFAULT: ReglaPrecio[] = [
  {
    id: "volumen_default",
    tipo: "volumen",
    enabled: true,
    prioridad: 10,
    parametros: {
      escalones: [
        { min: 5000, descuentoPct: 3 },
        { min: 10000, descuentoPct: 5 },
        { min: 15000, descuentoPct: 7 },
      ],
    },
  },
  {
    id: "metodo_pago_default",
    tipo: "metodo_pago",
    enabled: true,
    prioridad: 20,
    parametros: {
      efectivo: -2,
      transferencia: 0,
      credito: 3,
      tarjeta: 2,
    },
  },
  {
    id: "urgencia_default",
    tipo: "urgencia",
    enabled: true,
    prioridad: 30,
    parametros: {
      standard: 0,
      express: 15,
      emergency: 30,
    },
  },
  {
    id: "horario_default",
    tipo: "horario",
    enabled: true,
    prioridad: 40,
    parametros: {
      valle: { desde: "10:00", hasta: "16:00", ajuste: -5 },
      peak: { desde: "18:00", hasta: "22:00", ajuste: 10 },
      noche: { desde: "22:00", hasta: "06:00", ajuste: 10 },
    },
  },
  {
    id: "dia_semana_default",
    tipo: "dia_semana",
    enabled: true,
    prioridad: 50,
    parametros: {
      sabado: 5,
      domingo: 5,
    },
  },
  {
    id: "distancia_default",
    tipo: "distancia",
    enabled: false, // desactivada por defecto — el depot de la plataforma no es prioritario
    prioridad: 60,
    parametros: {
      radioBaseKm: 5,
      costoPorKmExtra: 50,
    },
  },
  {
    id: "historial_pago_default",
    tipo: "historial_pago",
    enabled: true,
    prioridad: 70,
    parametros: {
      moroso: 15,
      umbralDeuda: 50000,
    },
  },
  {
    id: "frecuencia_default",
    tipo: "frecuencia",
    enabled: true,
    prioridad: 80,
    parametros: {
      premium_meses_min: 24,
      ajuste: -2,
    },
  },
  // Reglas de mercado (fase 2) — activas por defecto, son las prioritarias
  {
    id: "disponibilidad_zona_default",
    tipo: "disponibilidad_zona",
    enabled: true,
    prioridad: 90,
    parametros: {
      umbrales: [
        { minRepartidores: 0, maxRepartidores: 0, ajustePct: 20 }, // sin rep → surge
        { minRepartidores: 1, maxRepartidores: 1, ajustePct: 10 },  // 1 rep → surge chico
        { minRepartidores: 2, maxRepartidores: 5, ajustePct: 0 },   // 2-5 → normal
        { minRepartidores: 6, maxRepartidores: 99, ajustePct: -5 }, // 6+ → descuento por competencia
      ],
    },
  },
  {
    id: "demanda_oferta_default",
    tipo: "demanda_oferta",
    enabled: true,
    prioridad: 100,
    parametros: {
      umbral_ratio: 1.5,
      ajuste_pct_base: 10,
      max_ajuste_pct: 25,
    },
  },
  // Reglas avanzadas (fase 3) — desactivadas por defecto
  {
    id: "demanda_default",
    tipo: "demanda",
    enabled: false, // reemplazada por demanda_oferta que es más completa
    prioridad: 110,
    parametros: {
      umbral_pedidos_hora: 10,
      ajuste_pct: 15,
      max_ajuste_pct: 20,
    },
  },
  {
    id: "clima_default",
    tipo: "clima",
    enabled: false,
    prioridad: 120,
    parametros: {
      temp_threshold_c: 30,
      dias_consecutivos: 3,
      ajuste_pct: 5,
    },
  },
  {
    id: "capacidad_default",
    tipo: "capacidad",
    enabled: false,
    prioridad: 130,
    parametros: {
      umbral_pct: 90,
      ajuste_pct: 5,
    },
  },
];

/**
 * Versión del motor. Se persiste en el snapshot para que en el futuro podamos
 * detectar pedidos que se calcularon con una versión vieja del motor.
 */
export const VERSION_MOTOR = "1.0.0";
