const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.usuario.findFirst({ where: { role: 'dueno' }, select: { email: true, passwordHash: true, nombre: true } });
  console.log('Dueño:', u.email, u.nombre);
  console.log('Hash:', u.passwordHash?.substring(0, 30) + '...');
}
main().then(() => prisma.$disconnect());
