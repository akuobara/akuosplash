const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({
    where: { nombre: { contains: 'Cerro' } },
  });
  
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    include: { 
      vuelta: { select: { numero: true, activa: true } },
    },
    orderBy: { fecha: 'asc' },
  });
  
  console.log('Entregas de Cerro con vuelta:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}`);
    console.log(`    litros=${e.litros} precio=${e.precioPorLitro} total=${e.total}`);
    console.log(`    ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
    console.log(`    vuelta: ${e.vuelta ? '#' + e.vuelta.numero + (e.vuelta.activa ? ' (activa)' : '') : 'sin vuelta'}`);
    console.log(`    choferId: ${e.choferId}`);
  }
  
  // Ver también los pagos
  const pagos = await prisma.pago.findMany({
    where: { clienteId: cerro.id },
  });
  console.log(`\nPagos sueltos: ${pagos.length}`);
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago}) - ${(p.nota || '').substring(0, 100)}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
