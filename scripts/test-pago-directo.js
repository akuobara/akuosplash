const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const vuelta = await prisma.vuelta.findFirst({ where: { activa: true } });
  const dueno = await prisma.usuario.findFirst({ where: { role: 'dueno' } });
  
  console.log('Simulando entrega con pago de $800.000 en efectivo...');
  
  // Simular exactamente lo que el backend hace
  const litros = 17000;
  const precioPorLitro = 8.7; // precio de Cerro
  const totalCalculado = Math.ceil((litros * precioPorLitro) / 100) * 100; // 147900
  const total = totalCalculado;
  
  const montoEfectivo = 800000;
  const montoTransferencia = 0;
  const montoRecibido = montoEfectivo + montoTransferencia;
  
  const excedente = total > 0 ? Math.max(0, montoRecibido - total) : 0;
  console.log(`Total: ${total}, Recibido: ${montoRecibido}, Excedente: ${excedente}`);
  
  const montoEfectivoParaEntrega = excedente > 0
    ? Math.max(0, montoEfectivo - Math.min(excedente, montoEfectivo))
    : montoEfectivo;
  const montoTransferenciaParaEntrega = excedente > 0
    ? Math.max(0, montoTransferencia - Math.max(0, excedente - montoEfectivo))
    : montoTransferencia;
  
  console.log(`Efectivo para entrega: ${montoEfectivoParaEntrega}`);
  console.log(`Transferencia para entrega: ${montoTransferenciaParaEntrega}`);
  
  // Crear la entrega
  const entrega = await prisma.entrega.create({
    data: {
      fecha: new Date(),
      clienteNombre: 'Cerro',
      clienteId: cerro.id,
      vueltaId: vuelta.id,
      choferId: dueno.id,
      duenoId: dueno.id,
      litros: litros,
      metodoPago: 'efectivo',
      precioPorLitro: precioPorLitro,
      total: total,
      montoEfectivo: montoEfectivoParaEntrega,
      montoTransferencia: montoTransferenciaParaEntrega,
      montoRecibido: montoEfectivoParaEntrega + montoTransferenciaParaEntrega,
      estadoPago: 'pagado',
      descuentoTipo: 'ninguno',
      descuentoPor: 'chofer',
    },
  });
  console.log(`Entrega creada: ${entrega.id}, total=${entrega.total}, recibido=${entrega.montoRecibido}`);
  
  // Crear el pago suelto por el excedente
  if (excedente > 0) {
    const pago = await prisma.pago.create({
      data: {
        clienteId: cerro.id,
        monto: excedente,
        metodoPago: 'efectivo',
        nota: `Excedente de entrega a Cerro (${excedente} pagados de más).`,
        choferId: dueno.id,
        duenoId: dueno.id,
      },
    });
    console.log(`Pago suelto creado: ${pago.id}, monto=${pago.monto}`);
  }
  
  // Calcular deuda final
  const todasEntregas = await prisma.entrega.findMany({ where: { clienteId: cerro.id }, select: { total: true, montoRecibido: true } });
  const todosPagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { monto: true } });
  const deuda = todasEntregas.reduce((s,e) => s + e.total, 0) - todasEntregas.reduce((s,e) => s + e.montoRecibido, 0) - todosPagos.reduce((s,p) => s + p.monto, 0);
  console.log(`\nDeuda final de Cerro: ${deuda}`);
  console.log(`  Ventas: ${todasEntregas.reduce((s,e) => s + e.total, 0)}`);
  console.log(`  Recibido: ${todasEntregas.reduce((s,e) => s + e.montoRecibido, 0)}`);
  console.log(`  Pagos sueltos: ${todosPagos.reduce((s,p) => s + p.monto, 0)}`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
