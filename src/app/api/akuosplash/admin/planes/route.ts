import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPlanConfigs, savePlanConfigs, DEFAULT_PLAN_CONFIGS, PlanId, PLAN_ORDER, PlanConfig, normalizePlanId } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/admin/planes
// Devuelve las configs de los 3 planes (gratis, premium, pro).
// Incluye "pago" como alias de "premium" para compat con DB existente.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  const configs = await getPlanConfigs();
  return NextResponse.json({ planes: configs, orden: PLAN_ORDER });
}

// PUT /api/akuosplash/admin/planes
// Body: { planes: Record<PlanId, PlanConfig> }
// Persiste las nuevas configs en AkuoConfig.planConfigsJson.
export async function PUT(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const incoming = body.planes;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "Se requiere { planes: {...} }" }, { status: 400 });
  }

  // Merge con defaults para no perder campos
  const merged: Record<PlanId, PlanConfig> = { ...DEFAULT_PLAN_CONFIGS };
  for (const k of ["gratis", "premium", "pro", "pago"] as PlanId[]) {
    const inc = incoming[k];
    if (!inc) continue;
    const canonical = k === "pago" ? "premium" : k;
    merged[canonical] = {
      ...DEFAULT_PLAN_CONFIGS[canonical],
      ...inc,
      id: canonical,
      features: {
        ...DEFAULT_PLAN_CONFIGS[canonical].features,
        ...(inc.features || {}),
      },
    };
  }
  // Sincronizar alias "pago" con "premium" (mismos datos)
  merged.pago = { ...merged.premium, id: "pago" };

  await savePlanConfigs(merged);
  return NextResponse.json({ ok: true, planes: merged });
}
