const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  console.log('Cerro ID:', cerro.id);
  
  // Buscar entregas con clienteNombre="Cerro" (incluso sin clienteId)
  const entregas = await prisma.entrega.findMany({
    where: { clienteNombre: 'Cerro' },
    orderBy: { fecha: 'desc' },
    take: 3,
    select: { fecha: true, clienteId: true, litros: true, total: true, montoEfectivo: true, montoRecibido: true, estadoPago: true },
  });
  console.log('\nEntregas con nombre Cerro:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: clienteId=${e.clienteId} litros=${e.litros} total=${e.total} ef=${e.montoEfectivo} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
  
  // Buscar pagos de Cerro
  const pagos = await prisma.pago.findMany({
    where: { clienteId: cerro.id },
    orderBy: { fecha: 'desc' },
    take: 3,
  });
  console.log('\nPagos de Cerro:', pagos.length);
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
  }
}
main().then(() => prisma.$disconnect());
