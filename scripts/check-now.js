const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const entregas = await prisma.entrega.count();
  const vueltas = await prisma.vuelta.count();
  const pagos = await prisma.pago.count();
  const clientes = await prisma.cliente.count();
  console.log('Entregas:', entregas);
  console.log('Vueltas:', vueltas);
  console.log('Pagos:', pagos);
  console.log('Clientes:', clientes);
  
  // Últimas 5 entregas
  const ultimas = await prisma.entrega.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    select: { fecha: true, clienteNombre: true, litros: true, total: true, montoRecibido: true },
  });
  console.log('\nÚltimas 5 entregas:');
  for (const e of ultimas) {
    console.log(`  ${e.fecha.toISOString()}: ${e.clienteNombre} ${e.litros}L $${e.total} recibido=$${e.montoRecibido}`);
  }
}
main().then(() => prisma.$disconnect());
