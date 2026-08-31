const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Buscar la última entrega de Cerro
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  
  const ultimaEntrega = await prisma.entrega.findFirst({
    where: { clienteId: cerro.id },
    orderBy: { fecha: 'desc' },
    select: { fecha: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
  });
  
  console.log('=== ÚLTIMA ENTREGA DE CERRO ===');
  console.log('Fecha:', ultimaEntrega?.fecha.toISOString());
  console.log('Litros:', ultimaEntrega?.litros);
  console.log('Total:', ultimaEntrega?.total);
  console.log('Efectivo:', ultimaEntrega?.montoEfectivo);
  console.log('Transferencia:', ultimaEntrega?.montoTransferencia);
  console.log('Recibido:', ultimaEntrega?.montoRecibido);
  console.log('Estado:', ultimaEntrega?.estadoPago);
  
  // Buscar el último pago suelto de Cerro
  const ultimoPago = await prisma.pago.findFirst({
    where: { clienteId: cerro.id },
    orderBy: { fecha: 'desc' },
    select: { fecha: true, monto: true, metodoPago: true, nota: true },
  });
  
  console.log('\n=== ÚLTIMO PAGO SUELTO DE CERRO ===');
  if (ultimoPago) {
    console.log('Fecha:', ultimoPago.fecha.toISOString());
    console.log('Monto:', ultimoPago.monto);
    console.log('Método:', ultimoPago.metodoPago);
    console.log('Nota:', ultimoPago.nota?.substring(0, 100));
  } else {
    console.log('NO HAY PAGO SUELTO');
  }
  
  // Calcular deuda
  const entregas = await prisma.entrega.findMany({ where: { clienteId: cerro.id }, select: { total: true, montoRecibido: true } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { monto: true } });
  const tv = entregas.reduce((s,e) => s+e.total, 0);
  const tr = entregas.reduce((s,e) => s+e.montoRecibido, 0);
  const tp = pagos.reduce((s,p) => s+p.monto, 0);
  console.log('\n=== DEUDA ===');
  console.log(`Ventas: ${tv}, Recibido: ${tr}, Pagos: ${tp}`);
  console.log(`Deuda: ${tv} - ${tr} - ${tp} = ${tv-tr-tp}`);
}
main().then(() => prisma.$disconnect());
