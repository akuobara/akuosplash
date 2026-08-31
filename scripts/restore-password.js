const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const backupPrisma = new PrismaClient({ datasources: { db: { url: 'file:/tmp/restore-db/db/custom.db' } } });

async function main() {
  // Leer el passwordHash original del backup
  const backupDueno = await backupPrisma.usuario.findFirst({
    where: { role: 'dueno' },
    select: { id: true, email: true, passwordHash: true },
  });
  
  console.log('Backup passwordHash:', backupDueno.passwordHash?.substring(0, 30) + '...');
  
  // Restaurar en la DB actual
  const actualizada = await prisma.usuario.update({
    where: { id: backupDueno.id },
    data: { passwordHash: backupDueno.passwordHash },
  });
  
  console.log('Contraseña restaurada para:', actualizada.email);
  
  await backupPrisma.$disconnect();
}
main().then(() => prisma.$disconnect());
