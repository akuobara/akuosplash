const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const entregas = await prisma.entrega.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    select: { fecha: true, clienteNombre: true, clienteId: true, litros: true, total: true, montoEfectivo: true, montoRecibido: true },
  });
  console.log('Últimas 5 entregas:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: ${e.clienteNombre} (id=${e.clienteId}) litros=${e.litros} total=${e.total} ef=${e.montoEfectivo} recibido=${e.montoRecibido}`);
  }
  
  const pagos = await prisma.pago.findMany({
    orderBy: { fecha: 'desc' },
    take: 3,
    include: { cliente: { select: { nombre: true } } },
  });
  console.log('\nÚltimos 3 pagos:');
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: ${p.cliente?.nombre} $${p.monto} (${p.metodoPago})`);
  }
}
main().then(() => prisma.$disconnect());
