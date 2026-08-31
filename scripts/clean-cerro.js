const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({
    where: { nombre: { contains: 'Cerro' } },
  });
  
  // Eliminar entregas con total=0 (son bugs de versiones intermedias del código)
  const entregasConTotalCero = await prisma.entrega.findMany({
    where: { clienteId: cerro.id, total: 0 },
    select: { id: true, fecha: true, litros: true, total: true },
  });
  
  console.log(`Entregas de Cerro con total=0 (a eliminar): ${entregasConTotalCero.length}`);
  for (const e of entregasConTotalCero) {
    console.log(`  - ${e.fecha.toISOString()}: litros=${e.litros} total=${e.total}`);
    // Desvincular de pedidos si existe
    await prisma.pedido.updateMany({
      where: { entregaId: e.id },
      data: { estado: "pendiente", entregaId: null, vueltaId: null },
    });
    await prisma.entrega.delete({ where: { id: e.id } });
  }
  
  // Mostrar estado final de Cerro
  const entregasRestantes = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { total: true, montoRecibido: true, litros: true, precioPorLitro: true },
  });
  
  const totalVentas = entregasRestantes.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregasRestantes.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagosSueltos = await prisma.pago.count({ where: { clienteId: cerro.id } }).then(c => c);
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { monto: true } });
  const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0);
  
  console.log(`\n=== Cerro después de limpieza ===`);
  console.log(`  Entregas restantes: ${entregasRestantes.length}`);
  for (const e of entregasRestantes) {
    console.log(`    - litros=${e.litros} precio=${e.precioPorLitro} total=${e.total} recibido=${e.montoRecibido}`);
  }
  console.log(`  Total ventas: ${totalVentas}`);
  console.log(`  Total recibido: ${totalRecibido}`);
  console.log(`  Pagos sueltos: ${sumaPagos} (${pagos.length} pagos)`);
  console.log(`  Deuda: ${totalVentas - totalRecibido - sumaPagos}`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
