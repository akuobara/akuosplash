const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const vueltas = await prisma.vuelta.findMany({
    orderBy: { numero: 'asc' },
    include: {
      _count: { select: { entregas: true } },
      camion: { select: { nombre: true, capacidad: true } },
      chofer: { select: { nombre: true } },
      entregas: { select: { litros: true, total: true, montoRecibido: true } },
    },
  });
  
  console.log('=== TODAS LAS VUELTAS ===');
  for (const v of vueltas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const ventas = v.entregas.reduce((s,e) => s+e.total, 0);
    const recibido = v.entregas.reduce((s,e) => s+e.montoRecibido, 0);
    const capacidad = v.camion?.capacidad || 0;
    const porcentaje = capacidad > 0 ? ((litros / capacidad) * 100).toFixed(1) : '0';
    const completada = litros >= capacidad * 0.975;
    
    console.log(`Vuelta #${v.numero}: ${v.entregas.length} entregas, ${litros}L, $${ventas}, activa=${v.activa}, completada=${completada} (${porcentaje}%), chofer=${v.chofer?.nombre}, camion=${v.camion?.nombre}`);
  }
  
  console.log('\n=== VUELTAS VÁLIDAS PARA LIQUIDACIÓN (completadas, no activas) ===');
  const validas = vueltas.filter(v => {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const capacidad = v.camion?.capacidad || 0;
    return litros >= capacidad * 0.975 && !v.activa;
  });
  console.log('Válidas:', validas.length);
  for (const v of validas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    console.log(`  Vuelta #${v.numero}: ${litros}L`);
  }
  
  console.log('\n=== VUELTAS NO COMPLETADAS ===');
  const noCompletadas = vueltas.filter(v => {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const capacidad = v.camion?.capacidad || 0;
    return litros < capacidad * 0.975 && !v.activa;
  });
  console.log('No completadas:', noCompletadas.length);
  for (const v of noCompletadas) {
    const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
    const capacidad = v.camion?.capacidad || 0;
    const porcentaje = capacidad > 0 ? ((litros / capacidad) * 100).toFixed(1) : '0';
    console.log(`  Vuelta #${v.numero}: ${litros}L de ${capacidad}L (${porcentaje}%), ${v.entregas.length} entregas`);
  }
}
main().then(() => prisma.$disconnect());
