const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar pagos sueltos que fueron creados por error (sin nota "Excedente" o con ella pero duplicados)
  // Estrategia: para cada pago suelto, verificar si ya está cubierto por una entrega con montoRecibido > total
  const pagos = await prisma.pago.findMany({
    include: {
      cliente: { select: { nombre: true } },
    },
  });
  
  console.log(`Total pagos sueltos: ${pagos.length}`);
  
  let eliminados = 0;
  for (const p of pagos) {
    // Si el pago fue creado por mi código intermedio (frontend que creaba pago por separado)
    // va a tener nota que contiene "Excedente" O no tener nota (los más viejos)
    // Verificar si hay una entrega del mismo cliente con montoRecibido >= total
    // en una fecha cercana (±5 minutos)
    const fechaPago = p.fecha;
    const fechaInicio = new Date(fechaPago.getTime() - 5 * 60 * 1000);
    const fechaFin = new Date(fechaPago.getTime() + 5 * 60 * 1000);
    
    const entregasCercanas = await prisma.entrega.findMany({
      where: {
        clienteId: p.clienteId,
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
    });
    
    for (const e of entregasCercanas) {
      // Si la entrega tiene montoRecibido > total, fue una entrega con excedente
      // Y el pago suelto es el excedente — pero si montoRecibido incluye el excedente
      // (versión vieja del código), el pago está duplicado
      if (e.montoRecibido > e.total && e.total > 0) {
        const excedenteEsperado = e.montoRecibido - e.total;
        // Si el pago suelto coincide con el excedente Y la entrega tiene montoRecibido que incluye el excedente
        // entonces el pago está duplicado (la deuda ya se redujo en la entrega)
        if (Math.abs(p.monto - excedenteEsperado) < 100) {
          console.log(`  Eliminando pago duplicado de ${p.cliente.nombre}: $${p.monto} (entrega ${e.id} tiene montoRecibido=${e.montoRecibido} > total=${e.total})`);
          await prisma.pago.delete({ where: { id: p.id } });
          eliminados++;
          break;
        }
      }
    }
  }
  
  console.log(`\nPagos duplicados eliminados: ${eliminados}`);
  
  // Mostrar estado final
  const clientes = await prisma.cliente.findMany({
    include: {
      entregas: { select: { total: true, montoRecibido: true } },
      pagos: { select: { monto: true } },
    },
  });
  
  console.log('\n=== Deudas después de limpieza ===');
  for (const c of clientes) {
    const totalVentas = c.entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = c.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = c.pagos.reduce((s, p) => s + p.monto, 0);
    const deuda = totalVentas - totalRecibido - totalPagosSueltos;
    if (Math.abs(deuda) > 100 || c.pagos.length > 0) {
      console.log(`  ${c.nombre}: deuda=${deuda} (ventas=${totalVentas} - recibido=${totalRecibido} - pagos=${totalPagosSueltos})`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
