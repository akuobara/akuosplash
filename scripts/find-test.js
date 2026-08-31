const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ultima = await prisma.entrega.findFirst({
    orderBy: { fecha: 'desc' },
    select: { fecha: true, clienteNombre: true, clienteId: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true },
  });
  console.log('=== ÚLTIMA ENTREGA (cualquier cliente) ===');
  console.log('Fecha:', ultima?.fecha.toISOString());
  console.log('Cliente:', ultima?.clienteNombre, 'ID:', ultima?.clienteId);
  console.log('Litros:', ultima?.litros);
  console.log('Total:', ultima?.total);
  console.log('Efectivo:', ultima?.montoEfectivo);
  console.log('Transferencia:', ultima?.montoTransferencia);
  console.log('Recibido:', ultima?.montoRecibido);
  console.log('Estado:', ultima?.estadoPago);
  
  // Buscar últimos pagos sueltos
  const ultimoPago = await prisma.pago.findFirst({
    orderBy: { fecha: 'desc' },
    include: { cliente: { select: { nombre: true } } },
  });
  console.log('\n=== ÚLTIMO PAGO SUELTO ===');
  if (ultimoPago) {
    console.log('Cliente:', ultimoPago.cliente?.nombre);
    console.log('Monto:', ultimoPago.monto);
    console.log('Método:', ultimoPago.metodoPago);
    console.log('Nota:', ultimoPago.nota?.substring(0, 100));
  }
}
main().then(() => prisma.$disconnect());
