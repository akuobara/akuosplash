import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-cliente-estanques?clienteId=XXX
// Muestra el campo estanquesJson del cliente tal como está en la DB.
// Útil para diagnosticar por qué el form de entrega dice "no tiene estanques".
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId en query" }, { status: 400 });
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nombre: true,
      estanquesJson: true,
      precioEfectivoPorLitro: true,
      precioTransferenciaPorLitro: true,
      precioCamionCompleto: true,
      duenoId: true,
    },
  });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  let estanquesParseados: any = null;
  let parseError: string | null = null;
  if (cliente.estanquesJson) {
    try {
      estanquesParseados = JSON.parse(cliente.estanquesJson);
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      duenoId: cliente.duenoId,
      estanquesJson_campo_crudo: cliente.estanquesJson,
      estanquesJson_parseado: estanquesParseados,
      parseError,
      cantidad_estanques: Array.isArray(estanquesParseados) ? estanquesParseados.length : 0,
      precioEfectivoPorLitro: cliente.precioEfectivoPorLitro,
      precioTransferenciaPorLitro: cliente.precioTransferenciaPorLitro,
      precioCamionCompleto: cliente.precioCamionCompleto,
    },
    diagnostico: {
      tiene_estanques: !!(estanquesParseados && Array.isArray(estanquesParseados) && estanquesParseados.length > 0),
      json_es_null: cliente.estanquesJson === null,
      json_es_vacio: cliente.estanquesJson === "" || cliente.estanquesJson === "[]",
      json_es_invalido: parseError !== null,
    },
  });
}
