const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { fecha: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
    orderBy: { fecha: 'asc' },
  });
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { fecha: true, monto: true, metodoPago: true, nota: true } });
  console.log('Entregas:');
  for (const e of entregas) console.log(`  ${e.fecha.toISOString()}: total=${e.total} ef=${e.montoEfectivo} tr=${e.montoTransferencia} recibido=${e.montoRecibido} estado=${e.estadoPago}`);
  console.log('Pagos:');
  for (const p of pagos) console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago}) nota=${p.nota?.substring(0,80)}`);
  const tv = entregas.reduce((s,e) => s+e.total, 0);
  const tr = entregas.reduce((s,e) => s+e.montoRecibido, 0);
  const tp = pagos.reduce((s,p) => s+p.monto, 0);
  console.log(`Deuda: ${tv} - ${tr} - ${tp} = ${tv-tr-tp}`);
}
main().then(() => prisma.$disconnect());
