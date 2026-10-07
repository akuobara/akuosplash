import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/transportista/perfil
// Devuelve los datos del repartidor + sus estadísticas + su vehículo
// Similar al /api/auth/me?perfil=true de Aljibe
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Buscar el vehículo del repartidor (puede tener varios, devolver el activo)
  const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
    where: { transportistaId: user.id, activo: true },
    orderBy: { creadoEn: "desc" },
  });

  // Stats: total entregas, total litros, valoración promedio, ingresos del mes
  const entregasHechas = await akuosplashDb.akuoEntrega.findMany({
    where: { transportistaId: user.id },
    select: { litros: true, total: true, creadoEn: true },
  });

  const totalEntregas = entregasHechas.length;
  const totalLitros = entregasHechas.reduce((s, e) => s + e.litros, 0);

  // Ingresos del mes actual
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const ventasMes = entregasHechas
    .filter(e => new Date(e.creadoEn) >= inicioMes)
    .reduce((s, e) => s + e.total, 0);

  // Valoración promedio
  const valoraciones = await akuosplashDb.akuoValoracion.findMany({
    where: { transportistaId: user.id },
    select: { rating: true },
  });
  const valoracionPromedio = valoraciones.length > 0
    ? valoraciones.reduce((s, v) => s + v.rating, 0) / valoraciones.length
    : 0;
  const totalValoraciones = valoraciones.length;

  return NextResponse.json({
    usuario: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      telefono: user.telefono,
      rol: user.rol,
      plan: user.plan,
      // Datos de empresa
      razonSocial: (user as any).razonSocial,
      direccionEmpresa: (user as any).direccionEmpresa,
      rutEmpresa: (user as any).rutEmpresa,
      // Datos del vehículo
      patenteVehiculo: (user as any).patenteVehiculo,
      tipoVehiculo: (user as any).tipoVehiculo,
      capacidadVehiculoKg: (user as any).capacidadVehiculoKg,
      // Áreas de cobertura
      areasCobertura: (user as any).areasCobertura,
      descripcion: (user as any).descripcion,
      // MP OAuth
      mpConnected: !!(user as any).mpUserId && !!(user as any).mpAccessToken,
      mpConnectedAt: (user as any).mpConnectedAt,
    },
    vehiculos: vehiculos.map(v => ({
      id: v.id, nombre: `${v.marca || ""} ${v.modelo || ""}`.trim() || v.patente,
      patente: v.patente, capacidad: v.capacidadLitros, activo: v.activo,
    })),
    stats: {
      totalEntregas,
      totalLitros,
      ventasMes,
      valoracionPromedio: Math.round(valoracionPromedio * 10) / 10,
      totalValoraciones,
    },
  });
}
