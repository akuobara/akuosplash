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

  // Merge con defaults para no perder campos (incluyendo `activa`)
  const merged: Record<PlanId, PlanConfig> = { ...DEFAULT_PLAN_CONFIGS };
  for (const k of ["gratis", "premium", "pro", "pago"] as PlanId[]) {
    const inc = incoming[k];
    if (!inc) continue;
    const canonical = k === "pago" ? "premium" : k;
    merged[canonical] = {
      ...DEFAULT_PLAN_CONFIGS[canonical],
      ...inc, // los cambios del usuario sobrescriben los defaults
      id: canonical,
      features: {
        ...DEFAULT_PLAN_CONFIGS[canonical].features,
        ...(inc.features || {}),
      },
    };
  }
  merged.pago = { ...merged.premium, id: "pago" };

  // Guardar con error real (no tragar errores)
  try {
    await savePlanConfigs(merged);
  } catch (e: any) {
    console.error("[admin/planes PUT] savePlanConfigs error:", e?.message);
    return NextResponse.json({ error: "No se pudo guardar: " + (e?.message || "error desconocido") }, { status: 500 });
  }

  // Verificar que se guardó releyendo de la DB
  const verify = await getPlanConfigs();
  return NextResponse.json({ ok: true, planes: verify });
}
