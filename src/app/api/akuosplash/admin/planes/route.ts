import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPlanConfigs, savePlanConfigs, DEFAULT_PLAN_CONFIGS, PlanId, PLAN_ORDER, PlanConfig } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/admin/planes
// Devuelve las configs de los 3 planes.
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
  for (const k of PLAN_ORDER) {
    const inc = incoming[k];
    if (!inc) continue;
    merged[k] = {
      ...DEFAULT_PLAN_CONFIGS[k],
      ...inc,
      id: k, // nunca cambiar el id
      features: {
        ...DEFAULT_PLAN_CONFIGS[k].features,
        ...(inc.features || {}),
      },
    };
  }

  await savePlanConfigs(merged);
  return NextResponse.json({ ok: true, planes: merged });
}
