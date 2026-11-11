import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/admin/planes-custom
// Lista todos los planes configurables
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    const r = await client.execute("SELECT * FROM AkuoPlanConfig ORDER BY orden ASC");
    return NextResponse.json({
      planes: r.rows.map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion || "",
        orden: p.orden || 0,
        activa: !!p.activo,
        activo: !!p.activo,
        precioMensual: p.precioMensual || 0,
        precioAnual: p.precioAnual || 0,
        precioSemanal: p.precioSemanal || 0,
        precioDiario: p.precioDiario || 0,
        comisionPct: p.comisionPct || 15,
        vehiculosPermitidos: p.vehiculosPermitidos || 1,
        choferesPermitidos: p.choferesPermitidos || 1,
        mpSplitMode: p.mpSplitMode || "none",
        ciclosDisponibles: (() => { try { return JSON.parse(p.ciclosDisponibles || '["mensual","anual"]'); } catch { return ["mensual","anual"]; } })(),
        feeManualFijo: p.feeManualFijo || 3290,
        feeManualPct: p.feeManualPct || 1.7,
        features: (() => { try { return JSON.parse(p.features || '{}'); } catch { return {}; } })(),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// POST /api/akuosplash/admin/planes-custom
// Crea un plan nuevo
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  if (!body.id?.trim() || !body.nombre?.trim()) {
    return NextResponse.json({ error: "ID y nombre son obligatorios" }, { status: 400 });
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const id = body.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const ahora = new Date().toISOString();

  try {
    // Check if exists
    const existing = await client.execute({ sql: "SELECT id FROM AkuoPlanConfig WHERE id = ?", args: [id] });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Ya existe un plan con ese ID" }, { status: 409 });
    }

    await client.execute({
      sql: `INSERT INTO AkuoPlanConfig (id, nombre, descripcion, orden, activo, precioMensual, precioAnual, precioSemanal, precioDiario, comisionPct, vehiculosPermitidos, choferesPermitidos, mpSplitMode, ciclosDisponibles, feeManualFijo, feeManualPct, features, creadoEn, actualizadoEn)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, body.nombre.trim(), body.descripcion || null, body.orden || 99,
        body.activo === false ? 0 : 1,
        Number(body.precioMensual) || 0, Number(body.precioAnual) || 0,
        Number(body.precioSemanal) || 0, Number(body.precioDiario) || 0,
        Number(body.comisionPct) || 15,
        Number(body.vehiculosPermitidos) || 1, Number(body.choferesPermitidos) || 1,
        body.mpSplitMode || "none",
        JSON.stringify(body.ciclosDisponibles || ["mensual", "anual"]),
        Number(body.feeManualFijo) || 3290, Number(body.feeManualPct) || 1.7,
        JSON.stringify(body.features || {}),
        ahora, ahora,
      ],
    });

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// PATCH /api/akuosplash/admin/planes-custom?id=X
// Actualiza un plan
export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });

  const body = await req.json();
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const setParts: string[] = ["actualizadoEn = ?"];
  const values: any[] = [new Date().toISOString()];

  const fields: Record<string, string> = {
    nombre: "nombre", descripcion: "descripcion", orden: "orden",
    precioMensual: "precioMensual", precioAnual: "precioAnual",
    precioSemanal: "precioSemanal", precioDiario: "precioDiario",
    comisionPct: "comisionPct", vehiculosPermitidos: "vehiculosPermitidos",
    choferesPermitidos: "choferesPermitidos", mpSplitMode: "mpSplitMode",
    feeManualFijo: "feeManualFijo", feeManualPct: "feeManualPct",
  };

  for (const [key, col] of Object.entries(fields)) {
    if (body[key] !== undefined) {
      setParts.push(`${col} = ?`);
      values.push(body[key]);
    }
  }
  if (body.activo !== undefined) { setParts.push("activo = ?"); values.push(body.activo ? 1 : 0); }
  if (body.ciclosDisponibles !== undefined) {
    setParts.push("ciclosDisponibles = ?");
    values.push(JSON.stringify(body.ciclosDisponibles));
  }
  if (body.features !== undefined) {
    setParts.push("features = ?");
    values.push(JSON.stringify(body.features));
  }

  values.push(id);

  try {
    await client.execute({
      sql: `UPDATE AkuoPlanConfig SET ${setParts.join(", ")} WHERE id = ?`,
      args: values,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// DELETE /api/akuosplash/admin/planes-custom?id=X
export async function DELETE(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });
  if (["gratis", "premium", "pro"].includes(id)) {
    return NextResponse.json({ error: "No se pueden eliminar los planes base" }, { status: 400 });
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    await client.execute({ sql: "DELETE FROM AkuoPlanConfig WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
