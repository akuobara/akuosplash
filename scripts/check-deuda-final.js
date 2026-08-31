const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const entregas = await prisma.entrega.findMany({ where: { clienteId: cerro.id }, select: { total: true, montoRecibido: true } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { monto: true } });
  const tv = entregas.reduce((s,e) => s+e.total, 0);
  const tr = entregas.reduce((s,e) => s+e.montoRecibido, 0);
  const tp = pagos.reduce((s,p) => s+p.monto, 0);
  console.log('Entregas:', entregas.length);
  console.log('Total ventas:', tv);
  console.log('Total recibido:', tr);
  console.log('Pagos sueltos:', tp);
  console.log('Deuda:', tv - tr - tp);
}
main().then(() => prisma.$disconnect());
