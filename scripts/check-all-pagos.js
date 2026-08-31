const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const todosPagos = await prisma.pago.findMany({
    include: { cliente: { select: { nombre: true } } },
    orderBy: { fecha: 'desc' },
  });
  
  console.log(`Total pagos en la DB: ${todosPagos.length}`);
  for (const p of todosPagos) {
    console.log(`  ${p.cliente?.nombre}: $${p.monto} (${p.metodoPago}) - ${p.fecha.toISOString()}`);
    if (p.nota) console.log(`    nota: ${p.nota.substring(0, 100)}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
