const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Comparar backup vs actual para ver exactamente qué borré
  const backupPrisma = new PrismaClient({ datasources: { db: { url: 'file:/tmp/restore-db/db/custom.db' } } });
  
  const backupEntregas = await backupPrisma.entrega.findMany({
    select: { id: true, clienteNombre: true, litros: true, total: true, vueltaId: true, fecha: true },
    orderBy: { fecha: 'asc' },
  });
  
  const currentEntregas = await prisma.entrega.findMany({
    select: { id: true, clienteNombre: true, litros: true, total: true, vueltaId: true, fecha: true },
    orderBy: { fecha: 'asc' },
  });
  
  // Entregas que estaban en el backup pero ya no existen
  const currentIds = new Set(currentEntregas.map(e => e.id));
  const borradas = backupEntregas.filter(e => !currentIds.has(e.id));
  
  console.log('=== ENTREGAS QUE BORRÉ ===');
  console.log('Total borradas del backup del 13 jul:', borradas.length);
  for (const e of borradas) {
    console.log(`  ${e.clienteNombre}: ${e.litros}L $${e.total} - ${e.fecha.toISOString()}`);
  }
  
  // Entregas nuevas que se crearon hoy (14 jul) y que también borré
  const entregasHoy = currentEntregas.filter(e => e.fecha > new Date('2026-07-14T00:00:00Z'));
  console.log('\n=== ENTREGAS CREADAS HOY (14 jul) ===');
  console.log('Total:', entregasHoy.length);
  for (const e of entregasHoy) {
    console.log(`  ${e.clienteNombre}: ${e.litros}L $${e.total} - ${e.fecha.toISOString()}`);
  }
  
  // Vueltas que perdieron entregas
  const backupVueltas = await backupPrisma.vuelta.findMany({
    include: { _count: { select: { entregas: true } }, camion: { select: { capacidad: true } } },
    orderBy: { numero: 'asc' },
  });
  
  console.log('\n=== VUELTAS EN BACKUP ===');
  for (const v of backupVueltas) {
    const litros = await backupPrisma.entrega.aggregate({ where: { vueltaId: v.id }, _sum: { litros: true } });
    const capacidad = v.camion?.capacidad || 0;
    const porc = capacidad > 0 ? ((litros._sum.litros || 0) / capacidad * 100).toFixed(1) : '0';
    console.log(`  Vuelta #${v.numero}: ${v._count.entregas} entregas, ${litros._sum.litros || 0}L (${porc}%)`);
  }
  
  await backupPrisma.$disconnect();
}
main().then(() => prisma.$disconnect());
