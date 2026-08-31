const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Verificar si la entrega ya existe
  const existe = await prisma.entrega.findUnique({ where: { id: 'cmrh37t0o0001q4t4o8ajhsk9' } });
  if (existe) {
    console.log('La entrega ya existe, no se puede restaurar');
    return;
  }
  
  // Leer la entrega del backup
  const backupPrisma = new PrismaClient({ datasources: { db: { url: 'file:/tmp/restore-db/db/custom.db' } } });
  const entrega = await backupPrisma.entrega.findUnique({ where: { id: 'cmrh37t0o0001q4t4o8ajhsk9' } });
  
  if (!entrega) {
    console.log('No se encontró la entrega en el backup');
    await backupPrisma.$disconnect();
    return;
  }
  
  console.log('Restaurando entrega:', entrega.clienteNombre, entrega.litros, 'L');
  
  // Restaurar
  const restaurada = await prisma.entrega.create({
    data: {
      id: entrega.id,
      fecha: entrega.fecha,
      clienteNombre: entrega.clienteNombre,
      clienteDireccion: entrega.clienteDireccion,
      clienteTelefono: entrega.clienteTelefono,
      clienteZona: entrega.clienteZona,
      clienteId: entrega.clienteId,
      vueltaId: entrega.vueltaId,
      choferId: entrega.choferId,
      duenoId: entrega.duenoId,
      litros: entrega.litros,
      metodoPago: entrega.metodoPago,
      precioPorLitro: entrega.precioPorLitro,
      total: entrega.total,
      montoEfectivo: entrega.montoEfectivo,
      montoTransferencia: entrega.montoTransferencia,
      montoRecibido: entrega.montoRecibido,
      estadoPago: entrega.estadoPago,
      descuento: entrega.descuento,
      descuentoTipo: entrega.descuentoTipo,
      descuentoPor: entrega.descuentoPor,
      fotoMedidorUrl: entrega.fotoMedidorUrl,
      nota: entrega.nota,
      creadoEn: entrega.creadoEn,
    },
  });
  
  console.log('Entrega restaurada:', restaurada.clienteNombre, restaurada.litros, 'L');
  
  // Verificar que la Vuelta #1 vuelve a ser válida
  const vueltas = await prisma.vuelta.findMany({
    where: { numero: 1 },
    include: {
      entregas: { select: { litros: true } },
      camion: { select: { capacidad: true } },
    },
  });
  
  const v = vueltas[0];
  const litros = v.entregas.reduce((s,e) => s+e.litros, 0);
  const cap = v.camion?.capacidad || 17250;
  console.log(`Vuelta #1 ahora: ${litros}L de ${cap}L (${(litros/cap*100).toFixed(1)}%)`);
  console.log(`Completada: ${litros >= cap * 0.975 ? 'SÍ' : 'NO'}`);
  
  await backupPrisma.$disconnect();
}
main().then(() => prisma.$disconnect());
