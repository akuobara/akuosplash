const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const dueno = await prisma.usuario.findFirst({ where: { role: 'dueno' }, select: { id: true, nombre: true, email: true } });
  console.log('Dueño:', dueno);
  
  // Verificar qué vueltas pertenecen al dueño
  const vueltasDueno = await prisma.vuelta.findMany({
    where: { choferId: dueno.id },
    select: { numero: true, activa: true },
  });
  console.log('Vueltas del dueño:', vueltasDueno.length);
  for (const v of vueltasDueno) {
    console.log(`  Vuelta #${v.numero} activa=${v.activa}`);
  }
  
  const choferes = await prisma.usuario.findMany({ where: { role: 'chofer', activo: true }, select: { id: true, nombre: true } });
  for (const c of choferes) {
    const v = await prisma.vuelta.findMany({ where: { choferId: c.id }, select: { numero: true, activa: true } });
    console.log(`\nVueltas de ${c.nombre}:`, v.length);
    for (const vv of v) {
      console.log(`  Vuelta #${vv.numero} activa=${vv.activa}`);
    }
  }
}
main().then(() => prisma.$disconnect());
