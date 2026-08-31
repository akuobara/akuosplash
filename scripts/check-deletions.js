const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Ver todas las vueltas con entregas
  const vueltas = await prisma.vuelta.findMany({
    orderBy: { numero: 'asc' },
    include: {
      _count: { select: { entregas: true } },
      entregas: { select: { litros: true, total: true, montoRecibido: true } },
      camion: { select: { capacidad: true } },
    },
  });
  
  console.log('=== ESTADO ACTUAL ===');
  let validas = 0;
  for (const v of vueltas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const capacidad = v.camion?.capacidad || 17250;
    const porc = ((litros / capacidad) * 100).toFixed(1);
    const completada = litros >= capacidad * 0.975;
    const tieneEntregas = v._count.entregas > 0;
    
    if (tieneEntregas) {
      const ventas = v.entregas.reduce((s,e) => s+e.total, 0);
      const recibido = v.entregas.reduce((s,e) => s+e.montoRecibido, 0);
      console.log(`Vuelta #${v.numero}: ${v._count.entregas} entregas, ${litros}L (${porc}%), $${ventas}, recibido=$${recibido}, activa=${v.activa}, completada=${completada}`);
      if (tieneEntregas) validas++;
    }
  }
  console.log(`\nVueltas con entregas: ${validas}`);
}
main().then(() => prisma.$disconnect());
