const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { id: true, fecha: true, litros: true, precioPorLitro: true, total: true, montoRecibido: true, estadoPago: true },
    orderBy: { fecha: 'asc' },
  });
  
  console.log('=== Entregas actuales de Cerro ===');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: litros=${e.litros} precio=${e.precioPorLitro} total=${e.total} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
  
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id } });
  console.log(`\nPagos sueltos: ${pagos.length}`);
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
  }
  
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  console.log(`\nDeuda: ${totalVentas} - ${totalRecibido} - ${totalPagos} = ${totalVentas - totalRecibido - totalPagos}`);
  
  console.log(`\n¿Querés que elimine entregas duplicadas? Las dos últimas tienen los mismos litros=15000 total=130500`);
  console.log(`Para eliminarlas, ejecutá el script con --clean`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
