const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({
    where: { nombre: { contains: 'Cerro' } },
    include: {
      entregas: { 
        select: { id: true, total: true, montoRecibido: true, montoEfectivo: true, montoTransferencia: true, fecha: true, litros: true, estadoPago: true, nota: true },
        orderBy: { fecha: 'asc' }
      },
      pagos: { 
        select: { id: true, monto: true, metodoPago: true, nota: true, fecha: true },
        orderBy: { fecha: 'asc' }
      },
    },
  });
  
  if (!cerro) {
    console.log('No se encontró Cerro');
    return;
  }
  
  console.log(`=== Cerro (${cerro.id}) ===`);
  console.log(`\nEntregas (${cerro.entregas.length}):`);
  for (const e of cerro.entregas) {
    console.log(`  ${e.fecha.toISOString()}`);
    console.log(`    litros=${e.litros} total=${e.total} recibido=${e.montoRecibido} (ef=${e.montoEfectivo} tr=${e.montoTransferencia}) estado=${e.estadoPago}`);
    if (e.nota) console.log(`    nota: ${e.nota.substring(0, 100)}`);
  }
  
  console.log(`\nPagos sueltos (${cerro.pagos.length}):`);
  for (const p of cerro.pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
    if (p.nota) console.log(`    nota: ${p.nota.substring(0, 150)}`);
  }
  
  const totalVentas = cerro.entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = cerro.entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagosSueltos = cerro.pagos.reduce((s, p) => s + p.monto, 0);
  console.log(`\nResumen:`);
  console.log(`  Total ventas: ${totalVentas}`);
  console.log(`  Total recibido en entregas: ${totalRecibido}`);
  console.log(`  Total pagos sueltos: ${totalPagosSueltos}`);
  console.log(`  Deuda calculada: ${totalVentas - totalRecibido - totalPagosSueltos}`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
