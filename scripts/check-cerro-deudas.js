const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { id: true, fecha: true, litros: true, precioPorLitro: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
    orderBy: { fecha: 'asc' },
  });
  
  const pagos = await prisma.pago.findMany({
    where: { clienteId: cerro.id },
    select: { id: true, fecha: true, monto: true, metodoPago: true, nota: true },
    orderBy: { fecha: 'asc' },
  });
  
  console.log(`=== Cerro (${cerro.id}) ===`);
  console.log(`\nEntregas (${entregas.length}):`);
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}`);
    console.log(`    litros=${e.litros} precio=${e.precioPorLitro} total=${e.total}`);
    console.log(`    ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  }
  
  console.log(`\nPagos sueltos (${pagos.length}):`);
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
    if (p.nota) console.log(`    nota: ${p.nota.substring(0, 150)}`);
  }
  
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
  console.log(`\n=== Cálculo de deuda ===`);
  console.log(`  Total ventas (sum total): ${totalVentas}`);
  console.log(`  Total recibido (sum montoRecibido): ${totalRecibido}`);
  console.log(`  Total pagos sueltos: ${totalPagosSueltos}`);
  console.log(`  Deuda = ${totalVentas} - ${totalRecibido} - ${totalPagosSueltos} = ${totalVentas - totalRecibido - totalPagosSueltos}`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
