const { PrismaClient } = require('@prisma/client');

async function check(label, url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const count = await prisma.entrega.count();
  const vueltas = await prisma.vuelta.count();
  console.log(`${label}: ${count} entregas, ${vueltas} vueltas`);
  
  // Mostrar todas las entregas
  const entregas = await prisma.entrega.findMany({
    select: { clienteNombre: true, litros: true, total: true, fecha: true },
    orderBy: { fecha: 'desc' },
    take: 20,
  });
  console.log('Últimas entregas:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: ${e.clienteNombre} ${e.litros}L $${e.total}`);
  }
  await prisma.$disconnect();
}

(async () => {
  await check('BACKUP (13 jul)', 'file:/tmp/restore-db/db/custom.db');
  console.log('---');
  await check('ACTUAL (14 jul)', 'file:/home/z/my-project/db/custom.db');
})();
