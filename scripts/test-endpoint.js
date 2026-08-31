const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar el dueño
  const dueno = await prisma.usuario.findFirst({ where: { role: 'dueno' } });
  console.log('Dueño:', dueno?.email, dueno?.id);
  
  // Buscar Cerro
  const cerro = await prisma.cliente.findFirst({ where: { nombre: { contains: 'Cerro' } } });
  console.log('Cerro:', cerro?.id);
  
  // Buscar una vuelta activa
  const vuelta = await prisma.vuelta.findFirst({ where: { activa: true } });
  console.log('Vuelta activa:', vuelta?.id, '#' + vuelta?.numero);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
