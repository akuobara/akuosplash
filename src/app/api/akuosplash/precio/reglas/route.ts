import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { REGLAS_DEFAULT, type ReglaPrecio } from "@/lib/precio-dinamico";

// GET /api/akuosplash/precio/reglas
// Devuelve las reglas configuradas por el superadmin (o defaults si no hay).
// Solo superadmin.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }
  const config = await akuosplashDb.akuoConfig.findFirst();
  let reglas: ReglaPrecio[] = REGLAS_DEFAULT;
  let precioDinamicoHabilitado = false;
  if (config) {
    precioDinamicoHabilitado = config.precioDinamicoHabilitado;
    if (config.reglasPrecioJson) {
      try {
        const parsed = JSON.parse(config.reglasPrecioJson);
        if (Array.isArray(parsed)) reglas = parsed;
      } catch {
        // ignore
      }
    }
  }
  return NextResponse.json({
    reglas,
    precioDinamicoHabilitado,
    defaults: REGLAS_DEFAULT,
  });
}

// PUT /api/akuosplash/precio/reglas
// Body: { reglas: ReglaPrecio[], precioDinamicoHabilitado?: boolean }
// Solo superadmin.
export async function PUT(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }
  const body = await req.json();
  const reglas = body.reglas;
  const precioDinamicoHabilitado = body.precioDinamicoHabilitado;

  if (!Array.isArray(reglas)) {
    return NextResponse.json({ error: "reglas debe ser un array" }, { status: 400 });
  }

  // Validar formato mínimo de cada regla
  for (const r of reglas) {
    if (!r.id || !r.tipo || typeof r.enabled !== "boolean" || typeof r.prioridad !== "number") {
      return NextResponse.json({ error: "Regla inválida: falta id/tipo/enabled/prioridad" }, { status: 400 });
    }
  }

  const json = JSON.stringify(reglas);
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) {
    // crear
    await akuosplashDb.akuoConfig.create({
      data: {
        reglasPrecioJson: json,
        precioDinamicoHabilitado: precioDinamicoHabilitado ?? false,
      },
    });
  } else {
    await akuosplashDb.akuoConfig.update({
      where: { id: config.id },
      data: {
        reglasPrecioJson: json,
        ...(precioDinamicoHabilitado !== undefined ? { precioDinamicoHabilitado } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true, reglas, precioDinamicoHabilitado });
}
