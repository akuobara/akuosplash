const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const r = await prisma.entrega.deleteMany({ where: { clienteId: cerro.id, montoRecibido: 0 } });
  console.log(`Eliminadas ${r.count} entregas bug de Cerro`);
  
  const entregas = await prisma.entrega.findMany({ where: { clienteId: cerro.id }, select: { total: true, montoRecibido: true } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { monto: true } });
  const deuda = entregas.reduce((s,e) => s+e.total, 0) - entregas.reduce((s,e) => s+e.montoRecibido, 0) - pagos.reduce((s,p) => s+p.monto, 0);
  console.log(`Cerro: ${entregas.length} entregas, ${pagos.length} pagos, deuda: ${deuda}`);
}
main().then(() => prisma.$disconnect());
