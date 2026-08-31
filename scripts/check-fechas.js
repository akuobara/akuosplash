const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const vueltas = await prisma.vuelta.findMany({
    select: { numero: true, iniciadaEn: true, cerradaEn: true, activa: true },
    orderBy: { numero: 'asc' },
  });
  
  console.log('Fechas de vueltas:');
  for (const v of vueltas) {
    const fecha = v.iniciadaEn.toISOString().substring(0, 10);
    console.log(`  Vuelta #${v.numero}: ${fecha} activa=${v.activa}`);
  }
}
main().then(() => prisma.$disconnect());
