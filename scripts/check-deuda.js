const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar el cliente más reciente con entregas
  const clientes = await prisma.cliente.findMany({
    include: {
      entregas: { select: { id: true, total: true, montoRecibido: true, montoEfectivo: true, montoTransferencia: true, fecha: true } },
      pagos: { select: { id: true, monto: true, metodoPago: true, nota: true, fecha: true } },
    },
    orderBy: { creadoEn: 'desc' },
    take: 3,
  });

  for (const c of clientes) {
    console.log(`\n=== ${c.nombre} (${c.id}) ===`);
    const totalVentas = c.entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = c.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = c.pagos.reduce((s, p) => s + p.monto, 0);
    const deuda = totalVentas - totalRecibido - totalPagosSueltos;
    console.log(`  Entregas: ${c.entregas.length}`);
    console.log(`  Total ventas: ${totalVentas}`);
    console.log(`  Total recibido en entregas: ${totalRecibido}`);
    console.log(`  Total pagos sueltos: ${totalPagosSueltos}`);
    console.log(`  Deuda calculada: ${deuda}`);
    
    console.log(`  Detalle de entregas:`);
    for (const e of c.entregas) {
      console.log(`    - ${e.fecha.toISOString()}: total=${e.total} recibido=${e.montoRecibido} (ef=${e.montoEfectivo} tr=${e.montoTransferencia})`);
    }
    console.log(`  Detalle de pagos sueltos:`);
    for (const p of c.pagos) {
      console.log(`    - ${p.fecha.toISOString()}: ${p.monto} (${p.metodoPago}) - ${(p.nota || '').substring(0, 80)}`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
