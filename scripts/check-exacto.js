const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { fecha: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
    orderBy: { fecha: 'asc' },
  });
  
  const pagos = await prisma.pago.findMany({
    where: { clienteId: cerro.id },
    select: { fecha: true, monto: true, metodoPago: true, nota: true },
    orderBy: { fecha: 'asc' },
  });
  
  console.log('=== CERRO ===');
  console.log('\nEntregas:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: litros=${e.litros} total=${e.total} ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
  
  console.log('\nPagos sueltos:');
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago}) nota=${p.nota?.substring(0,80)}`);
  }
  
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  console.log(`\nDeuda: ${totalVentas} - ${totalRecibido} - ${totalPagos} = ${totalVentas - totalRecibido - totalPagos}`);
}

main().then(() => prisma.$disconnect());
