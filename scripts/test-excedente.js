const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar un cliente y un chofer existentes
  const cliente = await prisma.cliente.findFirst();
  const chofer = await prisma.usuario.findFirst({ where: { role: 'dueno' } });
  
  if (!cliente || !chofer) {
    console.log('No hay cliente o chofer para probar');
    return;
  }
  
  console.log(`Probando con cliente: ${cliente.nombre} (${cliente.id})`);
  console.log(`Deuda anterior del cliente:`);
  
  const entregas = await prisma.entrega.findMany({ where: { clienteId: cliente.id } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: cliente.id } });
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  console.log(`  Ventas: ${totalVentas}, Recibido: ${totalRecibido}, Pagos sueltos: ${totalPagos}`);
  console.log(`  Deuda: ${totalVentas - totalRecibido - totalPagos}`);
  
  // Simular lo que haría el backend con una entrega con excedente
  const total = 100000;
  const montoEfectivo = 150000;
  const montoTransferencia = 0;
  const montoRecibido = montoEfectivo + montoTransferencia;
  const excedente = Math.max(0, montoRecibido - total);
  
  console.log(`\nSimulando entrega: total=${total}, efectivo=${montoEfectivo}, excedente=${excedente}`);
  
  const montoEfectivoParaEntrega = excedente > 0
    ? Math.max(0, montoEfectivo - Math.min(excedente, montoEfectivo))
    : montoEfectivo;
  const montoTransferenciaParaEntrega = excedente > 0
    ? Math.max(0, montoTransferencia - Math.max(0, excedente - montoEfectivo))
    : montoTransferencia;
  
  console.log(`  montoEfectivoParaEntrega=${montoEfectivoParaEntrega}`);
  console.log(`  montoTransferenciaParaEntrega=${montoTransferenciaParaEntrega}`);
  console.log(`  excedente=${excedente} → se crearía como pago suelto`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
