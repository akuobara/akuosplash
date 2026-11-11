import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPlanConfigs, savePlanConfigs, DEFAULT_PLAN_CONFIGS, PlanId, PLAN_ORDER, PlanConfig } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/admin/planes
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  const configs = await getPlanConfigs();
  return NextResponse.json({ planes: configs, orden: PLAN_ORDER });
}

// PUT /api/akuosplash/admin/planes
// Body: { planes: Record<PlanId, PlanConfig> }
// NO merguea defaults destructivamente: respeta los features que el superadmin setea.
// Sincroniza alias "pago" con "premium" pero no duplica.
export async function PUT(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const incoming = body.planes;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "Se requiere { planes: {...} }" }, { status: 400 });
  }

  console.log("[admin/planes PUT] incoming keys:", Object.keys(incoming));

  // Construir el dict final a guardar.
  // NO hacemos merge con DEFAULT_PLAN_CONFIGS — respetamos EXACTAMENTE lo que el
  // superadmin envió (comisión, precios, features, ciclosDisponibles, etc).
  // Solo usamos defaults para los campos que el frontend no envía (highlightColor, descripción larga).
  const toSave: Record<string, PlanConfig> = {};
  for (const k of Object.keys(incoming)) {
    if (k === "pago") continue; // alias legacy → ignorar, premium es el canónico
    const inc = incoming[k];
    if (!inc) continue;
    const defaultCfg = (DEFAULT_PLAN_CONFIGS as any)[k];
    toSave[k] = {
      id: k as PlanId,
      nombre: inc.nombre || defaultCfg?.nombre || k,
      descripcion: inc.descripcion ?? defaultCfg?.descripcion ?? "",
      precioMensual: Number(inc.precioMensual) || 0,
      precioAnual: Number(inc.precioAnual) || 0,
      precioSemanal: Number(inc.precioSemanal) || 0,
      precioDiario: Number(inc.precioDiario) || 0,
      ciclosDisponibles: Array.isArray(inc.ciclosDisponibles) ? inc.ciclosDisponibles : undefined,
      comisionPct: Number(inc.comisionPct) || 0,
      mpSplitMode: inc.mpSplitMode || defaultCfg?.mpSplitMode || "split",
      pagoDiferadoDias: inc.pagoDiferadoDias ?? defaultCfg?.pagoDiferadoDias ?? 0,
      maxVehiculos: Number(inc.maxVehiculos) || 0,
      maxChoferes: Number(inc.maxChoferes) || 0,
      activa: inc.activa !== false,
      highlightColor: inc.highlightColor || defaultCfg?.highlightColor || "blue",
      features: inc.features || defaultCfg?.features || {},
    } as PlanConfig;
  }

  try {
    await savePlanConfigs(toSave);
    console.log("[admin/planes PUT] savePlanConfigs OK — planes guardados:", Object.keys(toSave));
  } catch (e: any) {
    console.error("[admin/planes PUT] savePlanConfigs ERROR:", e?.message);
    return NextResponse.json({ error: "No se pudo guardar: " + (e?.message || "") }, { status: 500 });
  }

  // Verificar releyendo
  const verify = await getPlanConfigs();

  return NextResponse.json({ ok: true, planes: verify });
}
