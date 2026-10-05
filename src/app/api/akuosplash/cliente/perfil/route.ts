import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id, email: user.email, nombre: user.nombre, telefono: user.telefono,
      direccion: (user as any).direccion, comuna: (user as any).comuna,
      lat: (user as any).lat, lng: (user as any).lng, rut: (user as any).rut,
      indicacionesAcceso: (user as any).indicacionesAcceso,
      requiereClientePresente: (user as any).requiereClientePresente,
      usoAgua: (user as any).usoAgua,
      // Campos de transportista
      razonSocial: (user as any).razonSocial,
      direccionEmpresa: (user as any).direccionEmpresa,
      patenteVehiculo: (user as any).patenteVehiculo,
      tipoVehiculo: (user as any).tipoVehiculo,
      capacidadVehiculoKg: (user as any).capacidadVehiculoKg,
      areasCobertura: (user as any).areasCobertura,
      descripcion: (user as any).descripcion,
      avatarUrl: user.avatarUrl, rol: user.rol, plan: user.plan, creadoEn: user.creadoEn
    }
  });
}

export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  if (body.nombre !== undefined) data.nombre = body.nombre.trim();
  if (body.telefono !== undefined) data.telefono = body.telefono?.trim() || null;
  if (body.direccion !== undefined) data.direccion = body.direccion?.trim() || null;
  if (body.comuna !== undefined) data.comuna = body.comuna?.trim() || null;
  if (body.lat !== undefined) data.lat = body.lat ? Number(body.lat) : null;
  if (body.lng !== undefined) data.lng = body.lng ? Number(body.lng) : null;
  if (body.rut !== undefined) data.rut = body.rut?.trim() || null;
  if (body.indicacionesAcceso !== undefined) data.indicacionesAcceso = body.indicacionesAcceso?.trim() || null;
  if (body.requiereClientePresente !== undefined) data.requiereClientePresente = !!body.requiereClientePresente;
  if (body.usoAgua !== undefined) data.usoAgua = body.usoAgua;
  // Campos de transportista
  if (body.razonSocial !== undefined) data.razonSocial = body.razonSocial?.trim() || null;
  if (body.direccionEmpresa !== undefined) data.direccionEmpresa = body.direccionEmpresa?.trim() || null;
  if (body.patenteVehiculo !== undefined) data.patenteVehiculo = body.patenteVehiculo?.trim() || null;
  if (body.tipoVehiculo !== undefined) data.tipoVehiculo = body.tipoVehiculo;
  if (body.capacidadVehiculoKg !== undefined) data.capacidadVehiculoKg = body.capacidadVehiculoKg ? Number(body.capacidadVehiculoKg) : null;
  if (body.areasCobertura !== undefined) data.areasCobertura = body.areasCobertura?.trim() || null;
  if (body.descripcion !== undefined) data.descripcion = body.descripcion?.trim() || null;

  const actualizado = await akuosplashDb.akuoUsuario.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true, user: { id: actualizado.id, nombre: actualizado.nombre, telefono: actualizado.telefono } });
}
