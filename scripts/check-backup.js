const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'file:/tmp/restore-db/db/custom.db' } },
});
async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  if (!cerro) { console.log('No hay Cerro en el backup'); return; }
  
  const entregas = await prisma.entrega.findMany({
    where: { clienteId: cerro.id },
    select: { fecha: true, litros: true, total: true, montoEfectivo: true, montoRecibido: true, estadoPago: true, vueltaId: true },
    orderBy: { fecha: 'asc' },
  });
  console.log('Cerro en backup - Entregas:', entregas.length);
  for (const e of entregas) {
    console.log(`  ${e.fecha.toISOString()}: litros=${e.litros} total=${e.total} ef=${e.montoEfectivo} recibido=${e.montoRecibido} estado=${e.estadoPago} vuelta=${e.vueltaId}`);
  }
  
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id } });
  console.log('Pagos sueltos:', pagos.length);
  for (const p of pagos) {
    console.log(`  ${p.fecha.toISOString()}: $${p.monto} (${p.metodoPago})`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
