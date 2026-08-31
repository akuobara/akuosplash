const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Simular lo que ve el dueño con periodo "todo"
  const vueltas = await prisma.vuelta.findMany({
    where: { duenoId: 'cmrew9nii0001sv4vygw8rggv' },
    include: {
      _count: { select: { entregas: true } },
      entregas: { select: { litros: true, total: true, montoRecibido: true } },
      camion: { select: { capacidad: true } },
    },
    orderBy: { numero: 'asc' },
  });
  
  console.log('=== VUELTAS QUE VE EL DUEÑO (periodo todo) ===');
  let conEntregas = 0;
  let sinEntregas = 0;
  for (const v of vueltas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    if (v._count.entregas > 0) {
      conEntregas++;
      const ventas = v.entregas.reduce((s,e) => s+e.total, 0);
      console.log(`  Vuelta #${v.numero}: ${v._count.entregas} entregas, ${litros}L, $${ventas}`);
    } else {
      sinEntregas++;
    }
  }
  console.log(`\nCon entregas: ${conEntregas}, Sin entregas: ${sinEntregas}`);
}
main().then(() => prisma.$disconnect());
