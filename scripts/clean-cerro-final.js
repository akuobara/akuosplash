const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Eliminar entregas de Cerro con recibido=0 (bugs de versiones anteriores)
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  const eliminadas = await prisma.entrega.deleteMany({
    where: { clienteId: cerro.id, montoRecibido: 0 },
  });
  console.log(`Eliminadas ${eliminadas.count} entregas bug de Cerro (recibido=0)`);
  
  // Estado final
  const entregas = await prisma.entrega.findMany({ where: { clienteId: cerro.id }, select: { total: true, montoRecibido: true } });
  const pagos = await prisma.pago.findMany({ where: { clienteId: cerro.id }, select: { monto: true } });
  const deuda = entregas.reduce((s,e) => s + e.total, 0) - entregas.reduce((s,e) => s + e.montoRecibido, 0) - pagos.reduce((s,p) => s + p.monto, 0);
  console.log(`Cerro: ${entregas.length} entregas, ${pagos.length} pagos, deuda: ${deuda}`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
