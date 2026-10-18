import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/admin/cupones
// Lista todos los cupones (con filtros opcionales).
// Query: ?tipo=venta&activo=true&page=1&pageSize=50
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo");
  const activo = url.searchParams.get("activo");
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50");

  const where: string[] = [];
  const params: any[] = [];
  if (tipo) { where.push("tipo = ?"); params.push(tipo); }
  if (activo === "true") { where.push("activo = 1"); }
  else if (activo === "false") { where.push("activo = 0"); }

  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
  const offset = (page - 1) * pageSize;

  let cupones: any[] = [];
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT * FROM AkuoCupon ${whereSql} ORDER BY creadoEn DESC LIMIT ? OFFSET ?`,
      ...params, pageSize, offset
    );
    cupones = Array.isArray(r) ? r : [];
  } catch (e: any) {
    console.error("[admin/cupones] query failed:", e?.message);
  }

  let total = 0;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM AkuoCupon ${whereSql}`,
      ...params
    );
    if (Array.isArray(r) && r.length > 0) total = r[0].total || 0;
  } catch {}

  return NextResponse.json({
    cupones: cupones.map((c: any) => ({
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo,
      descuentoTipo: c.descuentoTipo,
      descuentoValor: c.descuentoValor,
      minMonto: c.minMonto,
      planIdAplicable: c.planIdAplicable,
      maxUsos: c.maxUsos,
      usos: c.usos,
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
      activo: !!c.activo,
      creadoPor: c.creadoPor,
      nota: c.nota,
      descripcionPublica: c.descripcionPublica,
      creadoEn: c.creadoEn,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// POST /api/akuosplash/admin/cupones
// Crea un nuevo cupón.
// Body: { codigo, tipo, descuentoTipo, descuentoValor, minMonto?, planIdAplicable?, maxUsos?, fechaInicio, fechaFin?, nota?, descripcionPublica? }
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const body = await req.json();

  // Validaciones
  const codigo = (body.codigo || "").trim().toUpperCase();
  if (!codigo) return NextResponse.json({ error: "Código obligatorio" }, { status: 400 });
  if (!["venta", "subscripcion"].includes(body.tipo)) {
    return NextResponse.json({ error: "Tipo inválido (debe ser 'venta' o 'subscripcion')" }, { status: 400 });
  }
  if (!["porcentaje", "monto_fijo", "meses_gratis"].includes(body.descuentoTipo)) {
    return NextResponse.json({ error: "descuentoTipo inválido" }, { status: 400 });
  }
  if (typeof body.descuentoValor !== "number" || body.descuentoValor < 0) {
    return NextResponse.json({ error: "descuentoValor debe ser número positivo" }, { status: 400 });
  }
  // Validar rango de porcentaje
  if (body.descuentoTipo === "porcentaje" && body.descuentoValor > 100) {
    return NextResponse.json({ error: "Porcentaje no puede ser mayor a 100" }, { status: 400 });
  }
  if (!body.fechaInicio) {
    return NextResponse.json({ error: "fechaInicio obligatoria" }, { status: 400 });
  }

  // Verificar que el código sea único
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id FROM AkuoCupon WHERE codigo = ? LIMIT 1`, codigo
    );
    if (Array.isArray(r) && r.length > 0) {
      return NextResponse.json({ error: "Ya existe un cupón con ese código" }, { status: 409 });
    }
  } catch {}

  // Insertar
  const id = `cup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ahora = new Date().toISOString();
  try {
    await akuosplashDb.$executeRawUnsafe(
      `INSERT INTO AkuoCupon (id, creadoEn, actualizadoEn, codigo, tipo, descuentoTipo, descuentoValor,
        minMonto, planIdAplicable, maxUsos, usos, fechaInicio, fechaFin, activo, creadoPor, nota, descripcionPublica)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?, ?)`,
      id, ahora, ahora, codigo, body.tipo, body.descuentoTipo, body.descuentoValor,
      body.minMonto ?? null, body.planIdAplicable ?? null, body.maxUsos ?? 0,
      new Date(body.fechaInicio).toISOString(),
      body.fechaFin ? new Date(body.fechaFin).toISOString() : null,
      user.id,
      body.nota ?? null,
      body.descripcionPublica ?? null
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo crear el cupón" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, codigo });
}
