const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Para Almácigo: el pago suelto de 36800 duplica el efectivo de la entrega de 36800
  // (la entrega ya tiene montoRecibido=36800, así que el pago suelto es extra)
  // Identificarlo: pago suelto donde el cliente tiene una entrega con montoRecibido > 0
  // y la suma de montos recibidos + pagos sueltos > total ventas
  
  const clientes = await prisma.cliente.findMany({
    include: {
      entregas: { select: { id: true, total: true, montoRecibido: true, fecha: true } },
      pagos: { select: { id: true, monto: true, nota: true, fecha: true } },
    },
  });
  
  let eliminados = 0;
  
  for (const c of clientes) {
    const totalVentas = c.entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = c.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = c.pagos.reduce((s, p) => s + p.monto, 0);
    
    // Si el cliente tiene saldo negativo (a favor) anómalo, hay duplicación
    if (totalVentas - totalRecibido - totalPagosSueltos < -100 && c.pagos.length > 0) {
      console.log(`\n${c.nombre}: deuda=${totalVentas - totalRecibido - totalPagosSueltos} (anómalo)`);
      console.log(`  Ventas=${totalVentas}, Recibido=${totalRecibido}, Pagos sueltos=${totalPagosSueltos}`);
      
      // Eliminar los pagos sueltos más antiguos que no tengan nota de "Excedente"
      // (los que fueron creados por versiones viejas del código)
      for (const p of c.pagos) {
        const esExcedente = p.nota && p.nota.includes('Excedente');
        if (!esExcedente) {
          console.log(`  Eliminando pago suelto sin nota de excedente: $${p.monto} del ${p.fecha.toISOString()}`);
          await prisma.pago.delete({ where: { id: p.id } });
          eliminados++;
        }
      }
    }
  }
  
  console.log(`\nTotal eliminados: ${eliminados}`);
  
  // Estado final
  console.log('\n=== Deudas después de limpieza ===');
  const clientesFinal = await prisma.cliente.findMany({
    include: {
      entregas: { select: { total: true, montoRecibido: true } },
      pagos: { select: { monto: true } },
    },
  });
  for (const c of clientesFinal) {
    const totalVentas = c.entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = c.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = c.pagos.reduce((s, p) => s + p.monto, 0);
    const deuda = totalVentas - totalRecibido - totalPagosSueltos;
    if (Math.abs(deuda) > 100 || c.pagos.length > 0) {
      console.log(`  ${c.nombre}: deuda=${deuda}`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
