const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Vueltas que alcanzaron 97.5% en el backup del 13 de julio
  const backupPrisma = new PrismaClient({ datasources: { db: { url: 'file:/tmp/restore-db/db/custom.db' } } });
  
  const backupVueltas = await backupPrisma.vuelta.findMany({
    include: {
      entregas: { select: { id: true, clienteNombre: true, litros: true } },
      camion: { select: { capacidad: true } },
    },
    orderBy: { numero: 'asc' },
  });
  
  console.log('=== BACKUP 13 JULIO - Vueltas completadas (>=97.5%) ===');
  let backupCompletadas = 0;
  const entregasBackup = new Set();
  for (const v of backupVueltas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const cap = v.camion?.capacidad || 17250;
    if (litros >= cap * 0.975) {
      backupCompletadas++;
      console.log(`  Vuelta #${v.numero}: ${litros}L de ${cap}L (${(litros/cap*100).toFixed(1)}%) - ${v.entregas.length} entregas`);
      for (const e of v.entregas) {
        entregasBackup.add(e.id);
        console.log(`    - ${e.clienteNombre}: ${e.litros}L (id: ${e.id})`);
      }
    }
  }
  console.log(`Total completadas en backup: ${backupCompletadas}`);
  
  // Ver cuáles de esas entregas siguen existiendo
  const currentEntregas = await prisma.entrega.findMany({ select: { id: true } });
  const currentIds = new Set(currentEntregas.map(e => e.id));
  
  console.log('\n=== ENTREGAS BORRADAS DE VUELTAS COMPLETADAS ===');
  for (const id of entregasBackup) {
    if (!currentIds.has(id)) {
      const backupEntrega = await backupPrisma.entrega.findUnique({ where: { id }, select: { clienteNombre: true, litros: true, total: true, vueltaId: true, fecha: true } });
      const vueltaNum = backupVueltas.find(v => v.id === backupEntrega.vueltaId)?.numero;
      console.log(`  Vuelta #${vueltaNum}: ${backupEntrega.clienteNombre} ${backupEntrega.litros}L $${backupEntrega.total} - BORRADA`);
    }
  }
  
  // Vueltas completadas ahora
  const currentVueltas = await prisma.vuelta.findMany({
    include: {
      entregas: { select: { litros: true } },
      camion: { select: { capacidad: true } },
    },
    orderBy: { numero: 'asc' },
  });
  
  console.log('\n=== AHORA - Vueltas completadas (>=97.5%) ===');
  let currentCompletadas = 0;
  for (const v of currentVueltas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const cap = v.camion?.capacidad || 17250;
    if (litros >= cap * 0.975) {
      currentCompletadas++;
      console.log(`  Vuelta #${v.numero}: ${litros}L de ${cap}L (${(litros/cap*100).toFixed(1)}%)`);
    }
  }
  console.log(`Total completadas ahora: ${currentCompletadas}`);
  
  await backupPrisma.$disconnect();
}
main().then(() => prisma.$disconnect());
