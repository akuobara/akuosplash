import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/vehiculos — lista de vehículos del transportista
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
    where: { transportistaId: user.id },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({
    camiones: vehiculos.map(v => ({
      id: v.id,
      nombre: `${v.marca || ""} ${v.modelo || ""}`.trim() || v.patente || "Vehículo",
      patente: v.patente,
      capacidad: v.capacidadLitros,
      activo: v.activo,
      marca: v.marca,
      modelo: v.modelo,
      año: v.año,
      tipo: v.tipo,
      // Documentos
      permisoCircUrl: v.permisoCircUrl,
      revisionTecUrl: v.revisionTecUrl,
      seguroUrl: v.seguroUrl,
      // Fotos
      fotoFrenteUrl: v.fotoFrenteUrl,
      fotoAtrasUrl: v.fotoAtrasUrl,
      fotoDerechaUrl: v.fotoDerechaUrl,
      fotoIzquierdaUrl: v.fotoIzquierdaUrl,
      // Estado
      documentosVerificados: v.documentosVerificados,
      verificadoEn: v.verificadoEn,
    })),
  });
}

// POST /api/akuosplash/vehiculos — crear vehículo con documentos y fotos
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const body = await req.json();

  // Validar campos obligatorios
  if (!body.patente?.trim()) return NextResponse.json({ error: "Patente obligatoria" }, { status: 400 });
  if (!body.capacidad || Number(body.capacidad) <= 0) return NextResponse.json({ error: "Capacidad obligatoria" }, { status: 400 });

  // Validar que tenga las 4 fotos del vehículo
  const fotos = [body.fotoFrenteUrl, body.fotoAtrasUrl, body.fotoDerechaUrl, body.fotoIzquierdaUrl];
  const fotosFaltantes = fotos.filter(f => !f).length;
  if (fotosFaltantes > 0) {
    return NextResponse.json({ error: `Faltan ${fotosFaltantes} foto(s) del vehículo. Se requieren: frente, atrás, derecha, izquierda.` }, { status: 400 });
  }

  // Validar documentos
  const docsFaltantes = [];
  if (!body.permisoCircUrl) docsFaltantes.push("Permiso de circulación");
  if (!body.revisionTecUrl) docsFaltantes.push("Revisión técnica");
  if (!body.seguroUrl) docsFaltantes.push("Seguro");
  if (docsFaltantes.length > 0) {
    return NextResponse.json({ error: `Faltan documentos: ${docsFaltantes.join(", ")}` }, { status: 400 });
  }

  const vehiculo = await akuosplashDb.akuoVehiculo.create({
    data: {
      transportistaId: user.id,
      patente: body.patente.trim(),
      tipo: body.tipo || "aljibe",
      capacidadLitros: Number(body.capacidad),
      marca: body.marca || null,
      modelo: body.modelo || null,
      año: body.año ? Number(body.año) : null,
      // Documentos
      permisoCircUrl: body.permisoCircUrl,
      revisionTecUrl: body.revisionTecUrl,
      seguroUrl: body.seguroUrl,
      // 4 fotos del vehículo
      fotoFrenteUrl: body.fotoFrenteUrl,
      fotoAtrasUrl: body.fotoAtrasUrl,
      fotoDerechaUrl: body.fotoDerechaUrl,
      fotoIzquierdaUrl: body.fotoIzquierdaUrl,
      // Pendiente de verificación del superadmin
      documentosVerificados: false,
    },
  });

  return NextResponse.json({
    ok: true,
    camion: {
      id: vehiculo.id, nombre: vehiculo.patente, patente: vehiculo.patente,
      capacidad: vehiculo.capacidadLitros, activo: vehiculo.activo,
    },
  }, { status: 201 });
}
