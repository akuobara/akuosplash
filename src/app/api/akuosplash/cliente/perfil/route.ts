import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const u = user as any;
  return NextResponse.json({
    user: {
      id: u.id, email: u.email, nombre: u.nombre, telefono: u.telefono,
      direccion: u.direccion, comuna: u.comuna, lat: u.lat, lng: u.lng,
      rut: u.rut, indicacionesAcceso: u.indicacionesAcceso, saldo: u.saldo,
      // Empresa
      razonSocial: u.razonSocial, direccionEmpresa: u.direccionEmpresa, rutEmpresa: u.rutEmpresa,
      giro: u.giro, inicioActividades: u.inicioActividades,
      comunaEmpresa: u.comunaEmpresa, ciudadEmpresa: u.ciudadEmpresa,
      telefonoEmpresa: u.telefonoEmpresa, emailEmpresa: u.emailEmpresa,
      // Banco
      bancoNombre: u.bancoNombre, bancoTipoCuenta: u.bancoTipoCuenta,
      bancoNumeroCuenta: u.bancoNumeroCuenta, bancoTitular: u.bancoTitular,
      bancoRutTitular: u.bancoRutTitular, bancoEmail: u.bancoEmail,
      // Facturación SII
      facturacionPlataforma: u.facturacionPlataforma, facturacionApiKey: u.facturacionApiKey,
      // Vehículo
      patenteVehiculo: u.patenteVehiculo, tipoVehiculo: u.tipoVehiculo, capacidadVehiculoKg: u.capacidadVehiculoKg,
      // Cobertura
      areasCobertura: u.areasCobertura, descripcion: u.descripcion,
      // MP
      mpConnected: !!u.mpUserId && !!u.mpAccessToken, mpConnectedAt: u.mpConnectedAt,
      // General
      avatarUrl: u.avatarUrl, rol: u.rol, plan: u.plan, creadoEn: u.creadoEn,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  // Datos personales
  if (body.nombre !== undefined) data.nombre = body.nombre?.trim() || null;
  if (body.telefono !== undefined) data.telefono = body.telefono?.trim() || null;
  if (body.direccion !== undefined) data.direccion = body.direccion?.trim() || null;
  if (body.comuna !== undefined) data.comuna = body.comuna?.trim() || null;
  if (body.lat !== undefined) data.lat = body.lat ? Number(body.lat) : null;
  if (body.lng !== undefined) data.lng = body.lng ? Number(body.lng) : null;
  if (body.rut !== undefined) { if (!body.rut?.trim()) return NextResponse.json({ error: "RUT obligatorio" }, { status: 400 }); data.rut = body.rut.trim(); }
  if (body.indicacionesAcceso !== undefined) data.indicacionesAcceso = body.indicacionesAcceso?.trim() || null;
  // Empresa
  if (body.razonSocial !== undefined) data.razonSocial = body.razonSocial?.trim() || null;
  if (body.direccionEmpresa !== undefined) data.direccionEmpresa = body.direccionEmpresa?.trim() || null;
  if (body.rutEmpresa !== undefined) data.rutEmpresa = body.rutEmpresa?.trim() || null;
  if (body.giro !== undefined) data.giro = body.giro?.trim() || null;
  if (body.inicioActividades !== undefined) data.inicioActividades = body.inicioActividades ? new Date(body.inicioActividades) : null;
  if (body.comunaEmpresa !== undefined) data.comunaEmpresa = body.comunaEmpresa?.trim() || null;
  if (body.ciudadEmpresa !== undefined) data.ciudadEmpresa = body.ciudadEmpresa?.trim() || null;
  if (body.telefonoEmpresa !== undefined) data.telefonoEmpresa = body.telefonoEmpresa?.trim() || null;
  if (body.emailEmpresa !== undefined) data.emailEmpresa = body.emailEmpresa?.trim() || null;
  // Banco
  if (body.bancoNombre !== undefined) data.bancoNombre = body.bancoNombre?.trim() || null;
  if (body.bancoTipoCuenta !== undefined) data.bancoTipoCuenta = body.bancoTipoCuenta || null;
  if (body.bancoNumeroCuenta !== undefined) data.bancoNumeroCuenta = body.bancoNumeroCuenta?.trim() || null;
  if (body.bancoTitular !== undefined) data.bancoTitular = body.bancoTitular?.trim() || null;
  if (body.bancoRutTitular !== undefined) data.bancoRutTitular = body.bancoRutTitular?.trim() || null;
  if (body.bancoEmail !== undefined) data.bancoEmail = body.bancoEmail?.trim() || null;
  // Facturación SII
  if (body.facturacionPlataforma !== undefined) data.facturacionPlataforma = body.facturacionPlataforma || null;
  if (body.facturacionApiKey !== undefined) data.facturacionApiKey = body.facturacionApiKey?.trim() || null;
  // Vehículo
  if (body.patenteVehiculo !== undefined) data.patenteVehiculo = body.patenteVehiculo?.trim() || null;
  if (body.tipoVehiculo !== undefined) data.tipoVehiculo = body.tipoVehiculo;
  if (body.capacidadVehiculoKg !== undefined) data.capacidadVehiculoKg = body.capacidadVehiculoKg ? Number(body.capacidadVehiculoKg) : null;
  // Cobertura
  if (body.areasCobertura !== undefined) data.areasCobertura = body.areasCobertura?.trim() || null;
  if (body.descripcion !== undefined) data.descripcion = body.descripcion?.trim() || null;

  const actualizado = await akuosplashDb.akuoUsuario.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true, user: { id: actualizado.id, nombre: actualizado.nombre, telefono: actualizado.telefono, saldo: actualizado.saldo } });
}
