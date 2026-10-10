import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/transportista/verificacion
// Devuelve el estado de verificación del transportista para participar en el marketplace
// Reglas: si quiere usar la app solo para productividad, ningún campo es obligatorio.
// Si quiere recibir pedidos del marketplace, debe cumplir:
// 1. Datos de empresa completos (razón social, RUT, giro)
// 2. Al menos un vehículo con documentos verificados
// 3. Al menos un chofer con documentación al día
// 4. Datos bancarios o MercadoPago conectado
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const u = user as any;
  const checks: { label: string; ok: boolean; detail?: string }[] = [];

  // 1. Datos de empresa
  const empresaOk = !!(u.razonSocial && u.rutEmpresa && u.giro);
  checks.push({ label: "Datos de empresa", ok: empresaOk, detail: empresaOk ? "Completos" : "Falta: razón social, RUT empresa o giro" });

  // 2. Vehículo con documentos verificados
  const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
    where: { transportistaId: user.id, activo: true },
    select: { id: true, patente: true, documentosVerificados: true, permisoCircUrl: true, revisionTecUrl: true, seguroUrl: true, fotoFrenteUrl: true, fotoAtrasUrl: true, fotoDerechaUrl: true, fotoIzquierdaUrl: true },
  });
  const vehiculosVerificados = vehiculos.filter(v => v.documentosVerificados).length;
  const vehiculosConDocs = vehiculos.filter(v => v.permisoCircUrl && v.revisionTecUrl && v.seguroUrl && v.fotoFrenteUrl && v.fotoAtrasUrl && v.fotoDerechaUrl && v.fotoIzquierdaUrl).length;
  checks.push({
    label: "Vehículo con documentos",
    ok: vehiculosVerificados > 0,
    detail: vehiculos.length === 0 ? "Sin vehículos registrados" :
           vehiculosConDocs === 0 ? "Vehículos sin documentos completos" :
           vehiculosVerificados === 0 ? "Documentos pendientes de verificación" :
           `${vehiculosVerificados} vehículo(s) verificado(s)`,
  });

  // 3. Chofer con documentación
  // En AkuoSplash, el transportista puede ser su propio chofer
  // Verificar que tenga licencia subida o que tenga un chofer en el equipo
  const choferes = await akuosplashDb.akuoUsuario.findMany({
    where: { rol: "chofer", activo: true },
  }).catch(() => []);
  // Por ahora, consideramos que el transportista puede ser chofer si tiene licencia
  // TODO: implementar choferes del equipo
  checks.push({
    label: "Chofer con documentación",
    ok: false, // Por ahora false hasta que se implemente
    detail: "Asigná un chofer desde la tab Equipo",
  });

  // 4. Datos de pago
  const tieneBanco = !!(u.bancoNombre && u.bancoNumeroCuenta);
  const tieneMP = !!(u.mpUserId && u.mpAccessToken);
  checks.push({
    label: "Método de pago",
    ok: tieneBanco || tieneMP,
    detail: tieneMP ? "MercadoPago conectado" :
           tieneBanco ? "Datos bancarios completos" :
           "Falta: conectar MercadoPago o completar datos bancarios",
  });

  const todoOk = checks.every(c => c.ok);
  const verificado = !!u.verificado;

  return NextResponse.json({
    verificado,
    puedeParticiparMarketplace: todoOk && verificado,
    modoProductividad: !todoOk,
    checks,
    resumen: todoOk
      ? "Cumplís todos los requisitos para participar en el marketplace"
      : "Estás en modo productividad. Completá los requisitos para recibir pedidos del marketplace.",
  });
}
