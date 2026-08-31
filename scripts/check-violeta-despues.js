const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const violeta = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Violeta' } } });
  const entregas = await prisma.entrega.findMany({ where: { clienteId: violeta.id }, select: { fecha: true, total: true, montoRecibido: true } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: violeta.id }, select: { fecha: true, monto: true, nota: true } });
  const tv = entregas.reduce((s,e) => s+e.total, 0);
  const tr = entregas.reduce((s,e) => s+e.montoRecibido, 0);
  const tp = pagos.reduce((s,p) => s+p.monto, 0);
  console.log('Violeta DESPUÉS:');
  console.log('  Entregas:', entregas.length, 'Pagos sueltos:', pagos.length);
  console.log('  Ventas:', tv, 'Recibido:', tr, 'Pagos:', tp);
  console.log('  Deuda:', tv - tr - tp);
  console.log('\nÚltima entrega:', JSON.stringify(entregas[entregas.length-1]));
  console.log('Último pago:', JSON.stringify(pagos[pagos.length-1]));
}
main().then(() => prisma.$disconnect());
