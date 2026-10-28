import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getComisionPorcentaje } from "@/lib/akuosplash-mercadopago";

// GET /api/akuosplash/cliente/precio
// Devuelve el precio por litro y comisión según la zona del cliente logueado
// Requiere auth — el precio NO es público
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo clientes" }, { status: 403 });
  }

  // Recargar usuario con su zona
  const usuarioConZona = await akuosplashDb.akuoUsuario.findUnique({
    where: { id: user.id },
    include: { zona: true },
  });
  if (!usuarioConZona) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const comisionPct = await getComisionPorcentaje();
  const config = await akuosplashDb.akuoConfig.findFirst();
  const precioDinamicoHabilitado = config?.precioDinamicoHabilitado ?? false;

  if (!usuarioConZona.zonaId || !usuarioConZona.zona) {
    // Sin zona asignada — no hay servicio disponible
    return NextResponse.json({
      precioPorLitro: null,
      comisionPct,
      zona: null,
      hayServicio: false,
      litrosMinimos: null,
      precioDinamicoHabilitado,
    });
  }

  return NextResponse.json({
    precioPorLitro: usuarioConZona.zona.precioPorLitro,
    comisionPct,
    zona: {
      id: usuarioConZona.zona.id,
      nombre: usuarioConZona.zona.nombre,
      litrosMinimos: usuarioConZona.zona.litrosMinimos,
    },
    hayServicio: true,
    litrosMinimos: usuarioConZona.zona.litrosMinimos,
    precioDinamicoHabilitado,
  });
}
