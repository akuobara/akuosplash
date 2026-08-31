const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const r = await prisma.entrega.deleteMany({ where: { clienteId: cerro.id } });
  await prisma.pago.deleteMany({ where: { clienteId: cerro.id } });
  console.log(`Eliminadas ${r.count} entregas y pagos de Cerro`);
}
main().then(() => prisma.$disconnect());
