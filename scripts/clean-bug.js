const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Eliminar SOLO la entrega bug de prueba (recibido=0, litros=17000, fecha reciente)
  const r = await prisma.entrega.deleteMany({
    where: { clienteNombre: 'Cerro', montoRecibido: 0, litros: 17000, fecha: { gte: new Date(Date.now() - 3600000) } }
  });
  console.log('Eliminadas entregas bug de prueba:', r.count);
}
main().then(() => prisma.$disconnect());
