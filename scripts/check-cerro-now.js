const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { fecha: true, litros: true, precioPorLitro: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
    orderBy: { fecha: 'desc' },
    take: 3,
  });
  
  const pagos = await prisma.pago.findMany({
    where: { clienteId: cerro.id },
    orderBy: { fecha: 'desc' },
    take: 3,
  });
  
  console.log('Cerro - últimas 3 entregas:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: total=${e.total} ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
  
  console.log('\nCerro - últimos 3 pagos sueltos:');
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
  }
  
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  console.log(`\nDeuda actual: ${totalVentas} - ${totalRecibido} - ${totalPagos} = ${totalVentas - totalRecibido - totalPagos}`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
