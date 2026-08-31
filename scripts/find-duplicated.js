const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar TODOS los clientes con sus entregas y pagos para encontrar el problema
  const clientes = await prisma.cliente.findMany({
    include: {
      entregas: { 
        select: { id: true, total: true, montoRecibido: true, montoEfectivo: true, montoTransferencia: true, fecha: true, litros: true },
        orderBy: { fecha: 'desc' }
      },
      pagos: { 
        select: { id: true, monto: true, metodoPago: true, nota: true, fecha: true },
        orderBy: { fecha: 'desc' }
      },
    },
  });

  for (const c of clientes) {
    const totalVentas = c.entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = c.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = c.pagos.reduce((s, p) => s + p.monto, 0);
    const deuda = totalVentas - totalRecibido - totalPagosSueltos;
    
    // Solo mostrar clientes con deuda o con pagos sueltos sospechosos
    if (Math.abs(deuda) > 1000 || c.pagos.length > 0) {
      console.log(`\n=== ${c.nombre} ===`);
      console.log(`  Deuda: ${deuda} (ventas=${totalVentas} - recibido=${totalRecibido} - pagosSueltos=${totalPagosSueltos})`);
      console.log(`  Entregas (${c.entregas.length}):`);
      for (const e of c.entregas) {
        console.log(`    - ${e.fecha.toISOString().substring(0,16)}: total=${e.total} recibido=${e.montoRecibido} (ef=${e.montoEfectivo} tr=${e.montoTransferencia}) litros=${e.litros}`);
      }
      console.log(`  Pagos sueltos (${c.pagos.length}):`);
      for (const p of c.pagos) {
        console.log(`    - ${p.fecha.toISOString().substring(0,16)}: ${p.monto} (${p.metodoPago}) - ${(p.nota || '').substring(0, 100)}`);
      }
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
