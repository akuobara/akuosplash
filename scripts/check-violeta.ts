import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const violeta = await db.cliente.findFirst({
    where: { nombre: { contains: "Violeta" } },
    select: { id: true, nombre: true, estanquesJson: true, precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true },
  });
  console.log("Cliente Violeta:", JSON.stringify(violeta, null, 2));

  const entrega = await db.entrega.findFirst({
    where: { clienteNombre: { contains: "Violeta" } },
    orderBy: { fecha: "desc" },
    select: { id: true, litros: true, total: true, detalleEstanquesJson: true, metodoPago: true, precioPorLitro: true, fecha: true },
  });
  console.log("\nEntrega más reciente de Violeta:", JSON.stringify(entrega, null, 2));
}

main().then(() => db.$disconnect());
