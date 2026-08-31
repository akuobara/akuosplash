const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({
    where: { nombre: { contains: 'Cerro' } },
    select: { 
      id: true, 
      nombre: true, 
      precioEfectivoPorLitro: true, 
      precioTransferenciaPorLitro: true,
    },
  });
  
  console.log('Cerro:', JSON.stringify(cerro, null, 2));
  
  const config = await prisma.configuracion.findFirst({
    select: { precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true, capacidadCamion: true },
  });
  console.log('Config global:', JSON.stringify(config, null, 2));
  
  // Ver las entregas de Cerro con más detalle
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { 
      fecha: true, litros: true, total: true, 
      montoEfectivo: true, montoTransferencia: true, montoRecibido: true,
      precioPorLitro: true, metodoPago: true, estadoPago: true,
      nota: true,
    },
    orderBy: { fecha: 'asc' },
  });
  
  console.log('\nEntregas de Cerro:');
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}`);
    console.log(`    litros=${e.litros} precioPorLitro=${e.precioPorLitro} total=${e.total}`);
    console.log(`    ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido}`);
    console.log(`    metodo=${e.metodoPago} estado=${e.estadoPago}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
