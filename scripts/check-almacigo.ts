import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Buscar la entrega más reciente de Almácigo
  const entrega = await db.entrega.findFirst({
    where: { clienteNombre: { contains: "Almácigo" } },
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      clienteNombre: true,
      litros: true,
      total: true,
      montoEfectivo: true,
      montoTransferencia: true,
      montoRecibido: true,
      estadoPago: true,
      metodoPago: true,
      precioPorLitro: true,
      vueltaId: true,
      detalleEstanquesJson: true,
      fecha: true,
    },
  });
  console.log("Entrega Almácigo más reciente:");
  console.log(JSON.stringify(entrega, null, 2));

  // Buscar la vuelta activa
  const vueltaActiva = await db.vuelta.findFirst({
    where: { activa: true },
    include: {
      entregas: {
        select: {
          id: true,
          clienteNombre: true,
          litros: true,
          total: true,
          montoEfectivo: true,
          montoTransferencia: true,
          montoRecibido: true,
        },
      },
    },
  });
  console.log("\n=== Vuelta activa ===");
  console.log(`Vuelta #${vueltaActiva?.numero} (${vueltaActiva?.id.substring(0, 8)})`);
  if (vueltaActiva) {
    const litros = vueltaActiva.entregas.reduce((s, e) => s + e.litros, 0);
    const ventas = vueltaActiva.entregas.reduce((s, e) => s + e.total, 0);
    const efectivo = vueltaActiva.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const transferencia = vueltaActiva.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
    console.log(`Entregas: ${vueltaActiva.entregas.length}`);
    console.log(`Litros: ${litros}`);
    console.log(`Ventas: ${ventas}`);
    console.log(`Efectivo: ${efectivo}`);
    console.log(`Transferencia: ${transferencia}`);
    console.log("\nDetalle por entrega:");
    for (const e of vueltaActiva.entregas) {
      console.log(`  ${e.clienteNombre}: ${e.litros}L total=${e.total} efectivo=${e.montoEfectivo} transf=${e.montoTransferencia} recibido=${e.montoRecibido}`);
    }
  }
}

main().then(() => db.$disconnect());
