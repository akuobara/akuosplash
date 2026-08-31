const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const e = await prisma.entrega.deleteMany({ where: { clienteId: cerro.id } });
  const p = await prisma.pago.deleteMany({ where: { clienteId: cerro.id } });
  console.log('Eliminadas', e.count, 'entregas y', p.count, 'pagos de Cerro');
  
  // También limpiar entregas con clienteId=null y nombre Cerro
  const e2 = await prisma.entrega.deleteMany({ where: { clienteNombre: 'Cerro', clienteId: null } });
  console.log('Eliminadas', e2.count, 'entregas sin clienteId de Cerro');
}
main().then(() => prisma.$disconnect());
