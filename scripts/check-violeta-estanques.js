const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const violeta = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Violeta' } } });
  
  const ultima = await prisma.entrega.findFirst({
    where: { clienteId: violeta.id },
    orderBy: { fecha: 'desc' },
    select: { fecha: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true, detalleEstanquesJson: true, precioPorLitro: true },
  });
  
  console.log('=== ÚLTIMA ENTREGA DE VIOLETA ===');
  console.log('Fecha:', ultima?.fecha.toISOString());
  console.log('Litros:', ultima?.litros);
  console.log('Precio:', ultima?.precioPorLitro);
  console.log('Total:', ultima?.total);
  console.log('Efectivo:', ultima?.montoEfectivo);
  console.log('Transferencia:', ultima?.montoTransferencia);
  console.log('Recibido:', ultima?.montoRecibido);
  console.log('Estado:', ultima?.estadoPago);
  console.log('Detalle estanques:', ultima?.detalleEstanquesJson?.substring(0, 500));
  
  const ultimoPago = await prisma.pago.findFirst({
    where: { clienteId: violeta.id },
    orderBy: { fecha: 'desc' },
    select: { fecha: true, monto: true, metodoPago: true, nota: true },
  });
  console.log('\n=== ÚLTIMO PAGO SUELTO ===');
  if (ultimoPago) {
    console.log('Fecha:', ultimoPago.fecha.toISOString());
    console.log('Monto:', ultimoPago.monto);
    console.log('Nota:', ultimoPago.nota?.substring(0, 200));
  } else {
    console.log('NO HAY PAGO SUELTO');
  }
  
  const entregas = await prisma.entrega.findMany({ where: { clienteId: violeta.id }, select: { total: true, montoRecibido: true } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: violeta.id }, select: { monto: true } });
  const tv = entregas.reduce((s,e) => s+e.total, 0);
  const tr = entregas.reduce((s,e) => s+e.montoRecibido, 0);
  const tp = pagos.reduce((s,p) => s+p.monto, 0);
  console.log('\n=== DEUDA ===');
  console.log('Ventas:', tv, 'Recibido:', tr, 'Pagos:', tp);
  console.log('Deuda:', tv - tr - tp);
}
main().then(() => prisma.$disconnect());
