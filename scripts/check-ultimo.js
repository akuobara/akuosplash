const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Ver todas las entregas recientes y pagos
  const entregas = await prisma.entrega.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    select: { clienteNombre: true, fecha: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
  });
  
  console.log('Últimas 5 entregas:');
  for (const e of entregas) {
    console.log(`  ${e.clienteNombre} ${e.fecha.toISOString()}: total=${e.total} ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
  
  const pagos = await prisma.pago.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    include: { cliente: { select: { nombre: true } } },
  });
  
  console.log('\nÚltimos 5 pagos sueltos:');
  for (const p of pagos) {
    console.log(`  ${p.cliente?.nombre} ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
