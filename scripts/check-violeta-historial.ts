import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const violeta = await db.cliente.findFirst({
    where: { nombre: { contains: "Violeta" } },
  });
  console.log("Violeta ID:", violeta?.id);

  const entregas = await db.entrega.findMany({
    where: { clienteId: violeta?.id },
    orderBy: { fecha: "desc" },
    select: { id: true, fecha: true, litros: true, total: true, montoRecibido: true, estadoPago: true, vueltaId: true },
  });
  console.log(`\nEntregas de Violeta (${entregas.length}):`);
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()} ${e.litros}L total=${e.total} recibido=${e.montoRecibido} estado=${e.estadoPago} vuelta=${e.vueltaId?.substring(0,8) ?? "null"}`);
  }

  const pedidos = await db.pedido.findMany({
    where: { clienteId: violeta?.id },
    orderBy: { creadoEn: "desc" },
    select: { id: true, creadoEn: true, litrosSolicitados: true, estado: true, entregaId: true },
  });
  console.log(`\nPedidos de Violeta (${pedidos.length}):`);
  for (const p of pedidos) {
    console.log(`  ${p.creadoEn.toISOString()} ${p.litrosSolicitados}L estado=${p.estado} entrega=${p.entregaId?.substring(0,8) ?? "null"}`);
  }

  // También buscar pedidos donde clienteNombre contenga Violeta pero clienteId sea null
  const pedidosSinCliente = await db.pedido.findMany({
    where: { clienteNombre: { contains: "Violeta" }, clienteId: null },
    select: { id: true, clienteNombre: true, litrosSolicitados: true, estado: true },
  });
  console.log(`\nPedidos con nombre 'Violeta' pero SIN clienteId (${pedidosSinCliente.length}):`);
  for (const p of pedidosSinCliente) {
    console.log(`  ${p.id.substring(0,8)} ${p.clienteNombre} ${p.litrosSolicitados}L estado=${p.estado}`);
  }

  // Buscar entregas donde clienteNombre contenga Violeta pero clienteId sea null o distinto
  const entregasSinCliente = await db.entrega.findMany({
    where: { clienteNombre: { contains: "Violeta" }, clienteId: null },
    select: { id: true, clienteNombre: true, litros: true, total: true, fecha: true },
  });
  console.log(`\nEntregas con nombre 'Violeta' pero SIN clienteId (${entregasSinCliente.length}):`);
  for (const e of entregasSinCliente) {
    console.log(`  ${e.id.substring(0,8)} ${e.clienteNombre} ${e.litros}L total=${e.total} ${e.fecha.toISOString()}`);
  }
}

main().then(() => db.$disconnect());
