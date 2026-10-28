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
  console.log("[admin/planes PUT] premium before merge:", { activa: incoming.premium?.activa, comisionPct: incoming.premium?.comisionPct, precioMensual: incoming.premium?.precioMensual });

  // Merge con defaults
  const merged: Record<PlanId, PlanConfig> = { ...DEFAULT_PLAN_CONFIGS };
  // Procesar primero "pago" (alias legacy) y DESPUÉS "premium" (canónico)
  // para que "premium" sobrescriba a "pago" y no al revés
  for (const k of ["gratis", "pago", "premium", "pro"] as PlanId[]) {
    const inc = incoming[k];
    if (!inc) continue;
    const canonical = k === "pago" ? "premium" : k;
    // Si ya procesamos "premium" y estamos procesando "pago", skip (no sobrescribir)
    if (k === "pago" && incoming.premium) continue;
    merged[canonical] = {
      ...DEFAULT_PLAN_CONFIGS[canonical],
      ...inc,
      id: canonical,
      features: { ...DEFAULT_PLAN_CONFIGS[canonical].features, ...(inc.features || {}) },
    };
  }
  // Sincronizar alias "pago" con "premium" (mismos datos)
  merged.pago = { ...merged.premium, id: "pago" };

  console.log("[admin/planes PUT] merged premium:", { activa: merged.premium?.activa, comisionPct: merged.premium?.comisionPct, precioMensual: merged.premium?.precioMensual });
  console.log("[admin/planes PUT] merged pro:", { activa: merged.pro?.activa });

  try {
    await savePlanConfigs(merged);
    console.log("[admin/planes PUT] savePlanConfigs OK");
  } catch (e: any) {
    console.error("[admin/planes PUT] savePlanConfigs ERROR:", e?.message);
    return NextResponse.json({ error: "No se pudo guardar: " + (e?.message || "") }, { status: 500 });
  }

  // Verificar releyendo
  const verify = await getPlanConfigs();
  console.log("[admin/planes PUT] verify premium:", { activa: verify.premium?.activa, comisionPct: verify.premium?.comisionPct, precioMensual: verify.premium?.precioMensual });
  console.log("[admin/planes PUT] verify pro:", { activa: verify.pro?.activa });

  return NextResponse.json({ ok: true, planes: verify });
}
