import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/set-estanques-cliente?clienteId=XXX&nombres=verde,bin,negro
// Setea los estanques de un cliente directamente.
// Los nombres vienen separados por comas.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  const nombres = searchParams.get("nombres");

  if (!clienteId || !nombres) {
    return NextResponse.json({ error: "Faltan parametros: clienteId y nombres (separados por comas)" }, { status: 400 });
  }

  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nombre: true, duenoId: true, estanquesJson: true } });
  if (!cliente || cliente.duenoId !== duenoId) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const listaNombres = nombres.split(",").map(n => n.trim()).filter(Boolean);
  const estanques = listaNombres.map(nombre => ({
    tipo: "estanque",
    capacidad: "",
    nombre,
    ubicacion: "",
    facturaSeparada: false,
  }));

  const estanquesJson = JSON.stringify(estanques);
  const actualizado = await db.cliente.update({
    where: { id: clienteId },
    data: { estanquesJson },
  });

  return NextResponse.json({
    ok: true,
    cliente: cliente.nombre,
    estanques_anteriores: cliente.estanquesJson,
    estanques_nuevos: estanques,
    message: `${estanques.length} estanque(s) agregados a ${cliente.nombre}: ${listaNombres.join(", ")}`,
  });
}
