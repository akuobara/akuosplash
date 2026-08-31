const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const mama = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Mama' } } });
  if (mama) {
    const r = await prisma.entrega.deleteMany({ where: { clienteId: mama.id, fecha: { gte: new Date(Date.now() - 3600000) } } });
    await prisma.pago.deleteMany({ where: { clienteId: mama.id, fecha: { gte: new Date(Date.now() - 3600000) } } });
    console.log('Limpiadas entregas y pagos de Mama asistente:', r.count);
  }
}
main().then(() => prisma.$disconnect());
