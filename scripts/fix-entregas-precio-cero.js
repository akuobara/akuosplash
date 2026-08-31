const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar todas las entregas con precioPorLitro=0 pero con litros>0
  const entregasBug = await prisma.entrega.findMany({
    where: {
      precioPorLitro: 0,
      litros: { gt: 0 },
    },
    include: {
      cliente: { select: { nombre: true, precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true } },
    },
  });
  
  console.log(`Entregas con precio=0 (a arreglar): ${entregasBug.length}`);
  
  for (const e of entregasBug) {
    const precioEfectivo = e.cliente?.precioEfectivoPorLitro || 0;
    const precioTransferencia = e.cliente?.precioTransferenciaPorLitro || 0;
    const precioMasAlto = Math.max(precioEfectivo, precioTransferencia);
    
    if (precioMasAlto > 0) {
      const nuevoTotal = Math.ceil((e.litros * precioMasAlto) / 100) * 100;
      console.log(`  ${e.cliente?.nombre} (${e.fecha.toISOString()}): litros=${e.litros} precio=0 total=${e.total} → precio=${precioMasAlto} total=${nuevoTotal}`);
      
      await prisma.entrega.update({
        where: { id: e.id },
        data: {
          precioPorLitro: precioMasAlto,
          total: nuevoTotal,
        },
      });
    }
  }
  
  // Mostrar estado final de Cerro
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  if (cerro) {
    const entregas = await prisma.entrega.findMany({
      where: { clienteId: cerro.id },
      select: { total: true, montoRecibido: true, litros: true, precioPorLitro: true },
    });
    const pagos = await prisma.pago.findMany({
      where: { clienteId: cerro.id },
      select: { monto: true },
    });
    
    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
    
    console.log(`\n=== Cerro después de arreglar ===`);
    console.log(`  Entregas: ${entregas.length}`);
    for (const e of entregas) {
      console.log(`    - litros=${e.litros} precio=${e.precioPorLitro} total=${e.total} recibido=${e.montoRecibido}`);
    }
    console.log(`  Total ventas: ${totalVentas}`);
    console.log(`  Total recibido: ${totalRecibido}`);
    console.log(`  Pagos sueltos: ${totalPagos}`);
    console.log(`  Deuda: ${totalVentas - totalRecibido - totalPagos}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
