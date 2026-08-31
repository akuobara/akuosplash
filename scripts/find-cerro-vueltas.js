const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Buscar vueltas que podían tener entregas de Cerro
  const vueltas = await prisma.vuelta.findMany({
    include: {
      entregas: { select: { id: true, clienteNombre: true, litros: true, total: true } },
      camion: { select: { nombre: true } },
      chofer: { select: { nombre: true } },
    },
    orderBy: { numero: 'asc' },
  });
  
  console.log('Vueltas y sus entregas:');
  for (const v of vueltas) {
    const cerroEntregas = v.entregas.filter(e => e.clienteNombre === 'Cerro');
    if (cerroEntregas.length > 0 || v.entregas.length === 0) {
      console.log(`  Vuelta #${v.numero}: ${v.entregas.length} entregas, ${cerroEntregas.length} de Cerro, camión=${v.camion?.nombre}, chofer=${v.chofer?.nombre}, activa=${v.activa}`);
      for (const e of v.entregas) {
        console.log(`    - ${e.clienteNombre}: ${e.litros}L $${e.total}`);
      }
    }
  }
}
main().then(() => prisma.$disconnect());
