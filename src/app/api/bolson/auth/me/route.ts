// GET /api/bolson/auth/me — devuelve el usuario actual
import { NextResponse } from "next/server";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET() {
  const user = await bolsonGetCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      telefono: user.telefono,
      nombre: user.nombre,
      rol: user.rol,
      aprobado: user.aprobado,
      banned: user.banned,
      rutEmpresa: user.rutEmpresa,
      razonSocial: user.razonSocial,
      capacidadCamionKg: user.capacidadCamionKg,
      patenteCamion: user.patenteCamion,
      tieneGrua: user.tieneGrua,
      tieneMotoneta: user.tieneMotoneta,
      areasCobertura: user.areasCobertura,
      descripcionServicios: user.descripcionServicios,
    },
  });
}
