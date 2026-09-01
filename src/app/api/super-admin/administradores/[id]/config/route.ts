import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// PATCH /api/super-admin/administradores/[id]/config
// Actualiza la configuración del admin
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  try {
    // Verificar que existe configuración
    const existente = await db.configuracion.findUnique({ where: { duenoId: id } });
    if (!existente) {
      // Crear si no existe
      const creado = await db.configuracion.create({
        data: {
          duenoId: id,
          nombreDueno: body.nombreDueno ?? "",
          nombreChofer: body.nombreChofer ?? "",
          empresaRazonSocial: body.empresaRazonSocial ?? null,
          empresaRut: body.empresaRut ?? null,
          empresaDireccion: body.empresaDireccion ?? null,
          empresaTelefono: body.empresaTelefono ?? null,
          empresaEmail: body.empresaEmail ?? null,
          empresaGiro: body.empresaGiro ?? null,
          empresaComuna: body.empresaComuna ?? null,
          empresaCiudad: body.empresaCiudad ?? null,
          capacidadCamion: Number(body.capacidadCamion) || 17000,
          modoLiquidacion: body.modoLiquidacion || "porcentaje",
          porcentajeComisionChofer: Number(body.porcentajeComisionChofer) || 0,
          porcentajeComisionDueno: Number(body.porcentajeComisionDueno) || 0,
          montoPorVueltaUnicoCliente: Number(body.montoPorVueltaUnicoCliente) || 0,
          montoPorVueltaMultiple: Number(body.montoPorVueltaMultiple) || 0,
          precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0,
          precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0,
        },
      });
      return NextResponse.json({ config: creado });
    }

    const data: Record<string, unknown> = {};
    const campos = [
      "nombreDueno", "nombreChofer",
      "empresaRazonSocial", "empresaRut", "empresaDireccion", "empresaTelefono", "empresaEmail",
      "empresaGiro", "empresaComuna", "empresaCiudad",
      "capacidadCamion", "modoLiquidacion",
      "porcentajeComisionChofer", "porcentajeComisionDueno",
      "montoPorVueltaUnicoCliente", "montoPorVueltaMultiple",
      "precioEfectivoPorLitro", "precioTransferenciaPorLitro",
      "tipoTributo", "porcentajeImpuesto", "aplicaImpuestoSobre",
      "umbralCompletacionVuelta",
    ];
    const numericos = new Set([
      "capacidadCamion", "porcentajeComisionChofer", "porcentajeComisionDueno",
      "montoPorVueltaUnicoCliente", "montoPorVueltaMultiple",
      "precioEfectivoPorLitro", "precioTransferenciaPorLitro",
      "porcentajeImpuesto", "umbralCompletacionVuelta",
    ]);
    for (const c of campos) {
      if (body[c] !== undefined) {
        data[c] = numericos.has(c) ? (Number(body[c]) || 0) : body[c];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const actualizado = await db.configuracion.update({
      where: { duenoId: id },
      data,
    });
    return NextResponse.json({ config: actualizado });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo actualizar la configuración" }, { status: 500 });
  }
}
