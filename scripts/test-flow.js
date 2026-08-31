const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Buscar datos reales
  const dueno = await prisma.usuario.findFirst({ where: { role: 'dueno' } });
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const vuelta = await prisma.vuelta.findFirst({ where: { activa: true } });
  
  if (!dueno || !cerro || !vuelta) {
    console.log('Faltan datos:', { dueno: !!dueno, cerro: !!cerro, vuelta: !!vuelta });
    return;
  }
  
  // 2. Simular el cálculo del frontend
  const litros = 17000;
  const precioPorLitro = 8.7;
  const totalCalculado = Math.ceil((litros * precioPorLitro) / 100) * 100; // 147900
  const total = totalCalculado;
  
  // El usuario paga 300000 en efectivo
  const montoEfectivo = 300000;
  const montoTransferencia = 0;
  const montoRecibido = montoEfectivo + montoTransferencia;
  
  // 3. Calcular excedente (igual que el backend)
  const excedente = total > 0 ? Math.max(0, montoRecibido - total) : 0;
  const montoEfectivoParaEntrega = excedente > 0
    ? Math.max(0, montoEfectivo - Math.min(excedente, montoEfectivo))
    : montoEfectivo;
  const montoTransferenciaParaEntrega = excedente > 0
    ? Math.max(0, montoTransferencia - Math.max(0, excedente - montoEfectivo))
    : montoTransferencia;
  const montoRecibidoParaEntrega = montoEfectivoParaEntrega + montoTransferenciaParaEntrega;
  
  console.log('=== SIMULACIÓN ===');
  console.log(`Entrega: ${litros}L × $${precioPorLitro} = $${total}`);
  console.log(`Pago: $${montoEfectivo} efectivo`);
  console.log(`Excedente: $${excedente}`);
  console.log(`Entrega se guarda con: recibido=$${montoRecibidoParaEntrega}`);
  console.log(`Pago suelto: $${excedente}`);
  console.log(`Deuda final: $${total} - $${montoRecibidoParaEntrega} - $${excedente} = $${total - montoRecibidoParaEntrega - excedente}`);
  
  // 4. VERIFICAR que el cálculo es correcto
  // Deuda = totalVentas - totalRecibido - totalPagosSueltos
  // = 147900 - 147900 - 152100 = -152100 (saldo a favor)
  const deudaEsperada = total - montoRecibidoParaEntrega - excedente;
  console.log(`\nDeuda esperada: $${deudaEsperada} (debe ser -$${excedente} = saldo a favor)`);
  
  if (deudaEsperada === -excedente) {
    console.log('✓ CÁLCULO CORRECTO');
  } else {
    console.log('✗ CÁLCULO INCORRECTO');
  }
}

main().then(() => prisma.$disconnect());
