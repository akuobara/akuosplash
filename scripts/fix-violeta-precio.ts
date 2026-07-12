// Fix: recalcular el total de la entrega de Violeta con el precio más alto (transferencia=8.7)
// ya que los estanques estaban en "credito" (sin pago) pero con precio=0
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const cliente = await db.cliente.findFirst({
    where: { nombre: { contains: "Violeta" } },
    select: { precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true },
  });
  const precioMayor = Math.max(cliente?.precioEfectivoPorLitro || 0, cliente?.precioTransferenciaPorLitro || 0);
  console.log("Precio mayor para Violeta:", precioMayor);

  const entrega = await db.entrega.findFirst({
    where: { clienteNombre: { contains: "Violeta" } },
    orderBy: { fecha: "desc" },
  });
  if (!entrega) { console.log("No hay entrega"); return; }

  // Recalcular detalle de estanques
  let estanques: any[] = [];
  try { estanques = JSON.parse(entrega.detalleEstanquesJson || "[]"); } catch {}
  let totalCalculado = 0;
  const estanquesActualizados = estanques.map((est) => {
    const nuevoTotal = (est.litros || 0) * precioMayor;
    totalCalculado += nuevoTotal;
    return { ...est, precioPorLitro: precioMayor, total: nuevoTotal };
  });

  const actualizada = await db.entrega.update({
    where: { id: entrega.id },
    data: {
      precioPorLitro: precioMayor,
      total: totalCalculado,
      detalleEstanquesJson: JSON.stringify(estanquesActualizados),
    },
  });
  console.log("Entrega actualizada:", actualizada.id, "total:", actualizada.total, "precioPorLitro:", actualizada.precioPorLitro);
  console.log("Deuda generada:", totalCalculado - actualizada.montoRecibido);
}

main().then(() => db.$disconnect());
