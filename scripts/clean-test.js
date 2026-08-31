const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.entrega.deleteMany({ where: { clienteNombre: 'Cerro' } });
  await prisma.pago.deleteMany({ where: { cliente: { nombre: { contains: 'Cerro' } } } });
  console.log('Limpio');
}
main().then(() => prisma.$disconnect());
