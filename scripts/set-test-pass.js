const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  // Cambiar contraseña del dueño a "test1234" temporalmente
  const u = await prisma.usuario.findFirst({ where: { role: 'dueno' } });
  const newHash = hashPassword('test1234');
  await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: newHash } });
  console.log('Contraseña cambiada a test1234 para', u.email);
}
main().then(() => prisma.$disconnect());
