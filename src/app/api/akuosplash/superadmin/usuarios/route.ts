import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/superadmin/usuarios?rol=transportista
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  await ensureAkuoConfigColumns();

  const { searchParams } = new URL(req.url);
  const rol = searchParams.get("rol") || undefined;

  // Raw SQL (Prisma findMany no funciona en Render)
  let sql = `SELECT id, email, nombre, telefono, rol, activo, aprobado, banned, banRazon, plan, creadoEn, ultimoLoginEn, razonSocial, patenteVehiculo, tipoVehiculo, rut, rutEmpresa, licenciaConducirUrl, capacidadVehiculoKg, areasCobertura, mpUserId, estadoAprobacion, estadoAprobacionNota, estadoAprobacionActualizadoEn FROM AkuoUsuario`;
  const args: any[] = [];
  if (rol) {
    sql += ` WHERE rol = ?`;
    args.push(rol);
  }
  sql += ` ORDER BY creadoEn DESC`;

  try {
    const rows: any = await akuosplashDb.$queryRawUnsafe(sql, ...args);
    const usuarios = Array.isArray(rows) ? rows.map((r: any) => ({
      ...r,
      activo: Boolean(r.activo),
      aprobado: Boolean(r.aprobado),
      banned: Boolean(r.banned),
      mpUserId: r.mpUserId ? true : false,
    })) : [];
    return NextResponse.json({ usuarios });
  } catch (e: any) {
    console.error("[superadmin/usuarios GET] error:", e?.message);
    return NextResponse.json({ error: "No se pudo listar usuarios: " + (e?.message || "") }, { status: 500 });
  }
}
