import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await ensureAkuoConfigColumns();
  // Recargar usuario con todos los campos (incluyendo licencia, permiso, seguro que antes no estaban)
  const u = (await akuosplashDb.akuoUsuario.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, nombre: true, telefono: true,
      direccion: true, comuna: true, lat: true, lng: true,
      rut: true, indicacionesAcceso: true, saldo: true,
      // Empresa
      razonSocial: true, direccionEmpresa: true, rutEmpresa: true,
      giro: true, inicioActividades: true,
      comunaEmpresa: true, ciudadEmpresa: true,
      telefonoEmpresa: true, emailEmpresa: true,
      // Banco
      bancoNombre: true, bancoTipoCuenta: true,
      bancoNumeroCuenta: true, bancoTitular: true,
      bancoRutTitular: true, bancoEmail: true,
      // Facturación SII
      facturacionPlataforma: true, facturacionApiKey: true,
      // Chofer (persona natural) — documentos
      licenciaConducirUrl: true, licenciaConducirAtrasUrl: true,
      permisoCircUrl: true, seguroUrl: true, revisonTecnicaUrl: true,
      // Vehículo
      patenteVehiculo: true, tipoVehiculo: true, capacidadVehiculoKg: true,
      // Fotos del vehículo
      fotoVehiculoFrenteUrl: true, fotoVehiculoAtrasUrl: true,
      fotoVehiculoIzquierdaUrl: true, fotoVehiculoDerechaUrl: true,
      // Cobertura
      areasCobertura: true, descripcion: true,
      // Precios
      precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true,
      // MP
      mpUserId: true, mpAccessToken: true, mpConnectedAt: true,
      // General
      avatarUrl: true, rol: true, plan: true, creadoEn: true,
      mpTestUserEmail: true,
    },
  }).catch(() => null)) || (user as any);

  return NextResponse.json({
    user: {
      id: u.id, email: u.email, nombre: u.nombre, telefono: u.telefono,
      direccion: u.direccion, comuna: u.comuna, lat: u.lat, lng: u.lng,
      rut: u.rut, indicacionesAcceso: u.indicacionesAcceso, saldo: u.saldo,
      razonSocial: u.razonSocial, direccionEmpresa: u.direccionEmpresa, rutEmpresa: u.rutEmpresa,
      giro: u.giro, inicioActividades: u.inicioActividades,
      comunaEmpresa: u.comunaEmpresa, ciudadEmpresa: u.ciudadEmpresa,
      telefonoEmpresa: u.telefonoEmpresa, emailEmpresa: u.emailEmpresa,
      bancoNombre: u.bancoNombre, bancoTipoCuenta: u.bancoTipoCuenta,
      bancoNumeroCuenta: u.bancoNumeroCuenta, bancoTitular: u.bancoTitular,
      bancoRutTitular: u.bancoRutTitular, bancoEmail: u.bancoEmail,
      facturacionPlataforma: u.facturacionPlataforma, facturacionApiKey: u.facturacionApiKey,
      // Chofer documents
      licenciaConducirUrl: u.licenciaConducirUrl,
      licenciaConducirAtrasUrl: u.licenciaConducirAtrasUrl,
      permisoCircUrl: u.permisoCircUrl,
      seguroUrl: u.seguroUrl,
      revisonTecnicaUrl: u.revisonTecnicaUrl,
      patenteVehiculo: u.patenteVehiculo, tipoVehiculo: u.tipoVehiculo, capacidadVehiculoKg: u.capacidadVehiculoKg,
      // Fotos del vehículo
      fotoVehiculoFrenteUrl: u.fotoVehiculoFrenteUrl,
      fotoVehiculoAtrasUrl: u.fotoVehiculoAtrasUrl,
      fotoVehiculoIzquierdaUrl: u.fotoVehiculoIzquierdaUrl,
      fotoVehiculoDerechaUrl: u.fotoVehiculoDerechaUrl,
      areasCobertura: u.areasCobertura, descripcion: u.descripcion,
      precioEfectivoPorLitro: u.precioEfectivoPorLitro, precioTransferenciaPorLitro: u.precioTransferenciaPorLitro,
      mpConnected: !!u.mpUserId && !!u.mpAccessToken, mpConnectedAt: u.mpConnectedAt,
      avatarUrl: u.avatarUrl, rol: u.rol, plan: u.plan, creadoEn: u.creadoEn,
      mpTestUserEmail: u.mpTestUserEmail,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await ensureAkuoConfigColumns();
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
  // Chofer (persona natural) — documentos
  if (body.licenciaConducirUrl !== undefined) data.licenciaConducirUrl = body.licenciaConducirUrl?.trim() || null;
  if (body.licenciaConducirAtrasUrl !== undefined) data.licenciaConducirAtrasUrl = body.licenciaConducirAtrasUrl?.trim() || null;
  if (body.permisoCircUrl !== undefined) data.permisoCircUrl = body.permisoCircUrl?.trim() || null;
  if (body.seguroUrl !== undefined) data.seguroUrl = body.seguroUrl?.trim() || null;
  if (body.revisonTecnicaUrl !== undefined) data.revisonTecnicaUrl = body.revisonTecnicaUrl?.trim() || null;
  // Vehículo
  if (body.patenteVehiculo !== undefined) data.patenteVehiculo = body.patenteVehiculo?.trim() || null;
  if (body.tipoVehiculo !== undefined) data.tipoVehiculo = body.tipoVehiculo;
  if (body.capacidadVehiculoKg !== undefined) data.capacidadVehiculoKg = body.capacidadVehiculoKg ? Number(body.capacidadVehiculoKg) : null;
  // Fotos del vehículo
  if (body.fotoVehiculoFrenteUrl !== undefined) data.fotoVehiculoFrenteUrl = body.fotoVehiculoFrenteUrl?.trim() || null;
  if (body.fotoVehiculoAtrasUrl !== undefined) data.fotoVehiculoAtrasUrl = body.fotoVehiculoAtrasUrl?.trim() || null;
  if (body.fotoVehiculoIzquierdaUrl !== undefined) data.fotoVehiculoIzquierdaUrl = body.fotoVehiculoIzquierdaUrl?.trim() || null;
  if (body.fotoVehiculoDerechaUrl !== undefined) data.fotoVehiculoDerechaUrl = body.fotoVehiculoDerechaUrl?.trim() || null;
  // Cobertura
  if (body.areasCobertura !== undefined) data.areasCobertura = body.areasCobertura?.trim() || null;
  if (body.descripcion !== undefined) data.descripcion = body.descripcion?.trim() || null;
  // Precios
  if (body.precioEfectivoPorLitro !== undefined) data.precioEfectivoPorLitro = body.precioEfectivoPorLitro ? Number(body.precioEfectivoPorLitro) : null;
  if (body.precioTransferenciaPorLitro !== undefined) data.precioTransferenciaPorLitro = body.precioTransferenciaPorLitro ? Number(body.precioTransferenciaPorLitro) : null;
  // MP test user email (para sandbox — formato test_user_<numeric>@testuser.com)
  if (body.mpTestUserEmail !== undefined) data.mpTestUserEmail = body.mpTestUserEmail?.trim() || null;

  // Usar raw SQL para evitar que el update retorne todas las columnas nuevas (mpSub* etc.)
  try {
    // Construir SET clause dinámicamente
    const fields = Object.keys(data);
    if (fields.length === 0) return NextResponse.json({ ok: true, note: "Sin cambios" });
    const setClause = fields.map((f, i) => `${f} = ?`).join(", ");
    const values = fields.map(f => {
      const v = data[f];
      if (v instanceof Date) return v.toISOString();
      return v;
    });
    values.push(user.id);
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET ${setClause} WHERE id = ?`,
      ...values
    );
  } catch (e: any) {
    console.error("[perfil PATCH] update failed:", e);
    return NextResponse.json({ error: "No se pudo actualizar: " + (e?.message || "") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
