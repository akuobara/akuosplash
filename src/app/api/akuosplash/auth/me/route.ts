import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function GET(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ user: null, hasUsers: true });

  const url = new URL(req.url);
  const withPerfil = url.searchParams.get("perfil") === "true";

  if (withPerfil) {
    // Versión con datos completos del perfil (como Aljibe /api/auth/me?perfil=true)
    const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
      where: { transportistaId: user.id, activo: true },
      orderBy: { creadoEn: "desc" },
    });
    const totalEntregas = await akuosplashDb.akuoEntrega.count({ where: { transportistaId: user.id } });
    const entregas = await akuosplashDb.akuoEntrega.findMany({
      where: { transportistaId: user.id },
      select: { litros: true, total: true, creadoEn: true },
    });
    const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const ventasMes = entregas.filter(e => new Date(e.creadoEn) >= inicioMes).reduce((s, e) => s + e.total, 0);
    const totalVueltas = await akuosplashDb.akuoVuelta.count({ where: { transportistaId: user.id } });

    return NextResponse.json({
      usuario: {
        id: user.id, userId: user.id, nombre: user.nombre, email: user.email,
        telefono: user.telefono, role: user.rol, activo: user.activo,
      },
      camiones: vehiculos.map(v => ({
        id: v.id, nombre: `${v.marca || ""} ${v.modelo || ""}`.trim() || v.patente,
        patente: v.patente, capacidad: v.capacidadLitros, activo: v.activo,
      })),
      stats: { totalEntregas, totalLitros, totalVueltas, ventasMes },
      dueno: null, // En AkuoSplash el transportista es el dueno
    });
  }

  return NextResponse.json({
    user: {
      id: user.id, userId: user.id, email: user.email, telefono: user.telefono,
      nombre: user.nombre, rol: user.rol, role: user.rol,
      aprobado: user.aprobado, plan: user.plan, avatarUrl: user.avatarUrl, activo: user.activo,
      // Flag para saber si el perfil está incompleto
      perfilIncompleto: user.rol === "cliente" && (!user.rut || !user.zonaId),
    },
    hasUsers: true,
  });
}
