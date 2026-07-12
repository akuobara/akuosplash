// Fix: vincular el pedido de Violeta con la entrega ya registrada
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Buscar la entrega más reciente de Violeta (en la vuelta activa #3)
  const entrega = await db.entrega.findFirst({
    where: { clienteNombre: { contains: "Violeta" } },
    orderBy: { fecha: "desc" },
  });
  console.log("Entrega encontrada:", entrega?.id, "vueltaId:", entrega?.vueltaId);

  // Buscar el pedido pendiente de Violeta
  const pedido = await db.pedido.findFirst({
    where: { clienteNombre: { contains: "Violeta" }, estado: "pendiente" },
    orderBy: { creadoEn: "desc" },
  });
  console.log("Pedido pendiente encontrado:", pedido?.id, "estado:", pedido?.estado);

  if (entrega && pedido) {
    const actualizado = await db.pedido.update({
      where: { id: pedido.id },
      data: {
        estado: "entregado",
        entregaId: entrega.id,
        vueltaId: entrega.vueltaId,
      },
    });
    console.log("Pedido actualizado:", actualizado.estado, "entregaId:", actualizado.entregaId);
  } else {
    console.log("No se encontraron registros para vincular");
  }
}

main().then(() => db.$disconnect());
