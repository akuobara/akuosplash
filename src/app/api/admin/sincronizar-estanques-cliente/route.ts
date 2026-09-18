import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/sincronizar-estanques-cliente
//
// Recorre todas las entregas del último año que tengan detalleEstanquesJson
// y actualiza el campo estanquesJson del cliente correspondiente, PERO SOLO
// si el cliente no tiene estanques registrados todavía (no sobrescribe la
// configuración existente).
//
// Esto resuelve el bug donde vos le entregaste a un cliente con 5 estanques
// pero el formulario decía "el cliente no tiene estanques registrados" la
// próxima vez.
//
// Query params:
//   ?clienteId=XXX → sincronizar solo ese cliente
//   ?sobrescribir=1 → sobrescribir incluso si el cliente ya tiene estanques
async function ejecutar(clienteIdFiltro?: string | null, sobrescribir: boolean = false) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const haceUnAno = new Date();
  haceUnAno.setDate(haceUnAno.getDate() - 365);

  const whereEntregas: any = {
    duenoId,
    detalleEstanquesJson: { not: null },
    clienteId: { not: null },
    fecha: { gte: haceUnAno },
  };
  if (clienteIdFiltro) whereEntregas.clienteId = clienteIdFiltro;

  const entregas = await db.entrega.findMany({
    where: whereEntregas,
    select: {
      id: true,
      clienteId: true,
      detalleEstanquesJson: true,
      fecha: true,
    },
    orderBy: { fecha: "desc" },
  });

  // Agrupar por clienteId → últimas estanques registradas en una entrega
  const estanquesPorCliente: Record<string, any[]> = {};
  for (const e of entregas) {
    if (!e.clienteId || !e.detalleEstanquesJson) continue;
    if (estanquesPorCliente[e.clienteId]) continue; // ya tenemos la más reciente
    try {
      const estanques = JSON.parse(e.detalleEstanquesJson);
      if (Array.isArray(estanques) && estanques.length > 0) {
        estanquesPorCliente[e.clienteId] = estanques;
      }
    } catch {}
  }

  const actualizados: Array<{ clienteId: string; cliente: string; cantidadEstanques: number }> = [];
  let sinCambios = 0;
  let errores = 0;

  for (const [clienteId, estanques] of Object.entries(estanquesPorCliente)) {
    try {
      const cliente = await db.cliente.findUnique({
        where: { id: clienteId },
        select: { id: true, nombre: true, estanquesJson: true, duenoId: true },
      });
      if (!cliente || cliente.duenoId !== duenoId) continue;

      const estanquesActuales = cliente.estanquesJson
        ? JSON.parse(cliente.estanquesJson)
        : [];

      const tieneEstanques = Array.isArray(estanquesActuales) && estanquesActuales.length > 0;

      if (tieneEstanques && !sobrescribir) {
        sinCambios++;
        continue;
      }

      // Convertir al formato del perfil del cliente
      const estanquesParaCliente = estanques.map((est: any) => ({
        tipo: est.tipo || "estanque",
        capacidad: String(est.capacidad || ""),
        nombre: est.nombre || "",
        ubicacion: est.ubicacion || "",
        facturaSeparada: !!est.facturaSeparada,
      }));

      await db.cliente.update({
        where: { id: clienteId },
        data: { estanquesJson: JSON.stringify(estanquesParaCliente) },
      });

      actualizados.push({
        clienteId,
        cliente: cliente.nombre,
        cantidadEstanques: estanquesParaCliente.length,
      });
    } catch (e) {
      errores++;
      console.error(`Error sincronizando cliente ${clienteId}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    clientesRevisados: Object.keys(estanquesPorCliente).length,
    clientesActualizados: actualizados.length,
    sinCambios,
    errores,
    detalle: actualizados,
    message: `Revisados ${Object.keys(estanquesPorCliente).length} clientes con entregas por estanque. ${actualizados.length} actualizados, ${sinCambios} ya tenían estanques.`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  const sobrescribir = searchParams.get("sobrescribir") === "1";
  return ejecutar(clienteId, sobrescribir);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return ejecutar(body.clienteId, body.sobrescribir === true);
  } catch {
    return ejecutar(null, false);
  }
}
