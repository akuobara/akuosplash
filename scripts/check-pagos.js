const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const pagosExcedente = await prisma.pago.findMany({
    where: { nota: { contains: 'Excedente' } },
    orderBy: { fecha: 'desc' },
    take: 10,
    include: { cliente: { select: { nombre: true } } }
  });
  console.log('Pagos por excedente:', pagosExcedente.length);
  for (const p of pagosExcedente) {
    console.log(`  - ${p.cliente?.nombre}: $${p.monto} (${p.metodoPago}) - ${p.nota?.substring(0, 80)}`);
  }
  
  const ultimosPagos = await prisma.pago.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    include: { cliente: { select: { nombre: true } } }
  });
  console.log('\nÚltimos 5 pagos (cualquier tipo):');
  for (const p of ultimosPagos) {
    console.log(`  - ${p.cliente?.nombre}: $${p.monto} (${p.metodoPago}) - ${(p.nota || '').substring(0, 80)}`);
  }

  const ultimasEntregas = await prisma.entrega.findMany({
    orderBy: { fecha: 'desc' },
    take: 5,
    include: { cliente: { select: { nombre: true } } }
  });
  console.log('\nÚltimas 5 entregas:');
  for (const e of ultimasEntregas) {
    console.log(`  - ${e.clienteNombre}: litros=${e.litros} total=${e.total} efectivo=${e.montoEfectivo} transf=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
