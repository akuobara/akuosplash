// Fix: recalcular montoEfectivo, montoTransferencia, montoRecibido de entregas con estanques
// donde el montoRecibido del estanque era 0 pero el método era efectivo/transferencia.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const entregas = await db.entrega.findMany({
    where: { detalleEstanquesJson: { not: null } },
    select: { id: true, clienteNombre: true, detalleEstanquesJson: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
  });

  console.log(`Procesando ${entregas.length} entregas con estanques...`);

  for (const e of entregas) {
    let estanques: any[] = [];
    try { estanques = JSON.parse(e.detalleEstanquesJson || "[]"); } catch { continue; }
    if (estanques.length === 0) continue;

    // Normalizar cada estanque
    let cambiado = false;
    for (const est of estanques) {
      const totalEst = (est.litros || 0) * (est.precioPorLitro || 0);
      if (est.metodoPago !== "credito" && (!est.montoRecibido || est.montoRecibido === 0) && totalEst > 0) {
        est.montoRecibido = Math.round(totalEst);
        cambiado = true;
      }
    }

    if (!cambiado) continue;

    // Recalcular totales
    const totalEfectivo = estanques.filter((e) => e.metodoPago === "efectivo").reduce((s, e) => s + (e.montoRecibido || 0), 0);
    const totalTransferencia = estanques.filter((e) => e.metodoPago === "transferencia").reduce((s, e) => s + (e.montoRecibido || 0), 0);
    const totalRecibido = totalEfectivo + totalTransferencia;
    const totalVenta = estanques.reduce((s, e) => s + (e.litros || 0) * (e.precioPorLitro || 0), 0);

    let estadoPago = "pendiente";
    if (totalRecibido >= totalVenta && totalVenta > 0) estadoPago = "pagado";
    else if (totalRecibido > 0) estadoPago = "parcial";

    await db.entrega.update({
      where: { id: e.id },
      data: {
        montoEfectivo: totalEfectivo,
        montoTransferencia: totalTransferencia,
        montoRecibido: totalRecibido,
        estadoPago,
        detalleEstanquesJson: JSON.stringify(estanques),
      },
    });
    console.log(`  ✓ ${e.clienteNombre}: efectivo=${totalEfectivo} transf=${totalTransferencia} estado=${estadoPago}`);
  }

  console.log("Done.");
}

main().then(() => db.$disconnect());
