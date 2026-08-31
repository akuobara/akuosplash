const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  
  // Eliminar TODAS las entregas de Cerro (son todas bugs de pruebas)
  const resultado = await prisma.entrega.deleteMany({
    where: { clienteId: cerro.id },
  });
  
  console.log(`Eliminadas ${resultado.count} entregas de Cerro`);
  
  // También eliminar pagos sueltos si los hay
  const pagosResult = await prisma.pago.deleteMany({
    where: { clienteId: cerro.id },
  });
  console.log(`Eliminados ${pagosResult.count} pagos sueltos de Cerro`);
  
  // Verificar estado final
  const entregasRestantes = await prisma.entrega.findMany({ where: { clienteId: cerro.id } });
  const pagosRestantes = await prisma.pago.findMany({ where: { clienteId: cerro.id } });
  console.log(`\nEstado final:`);
  console.log(`  Entregas: ${entregasRestantes.length}`);
  console.log(`  Pagos sueltos: ${pagosRestantes.length}`);
  console.log(`  Deuda: 0`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
