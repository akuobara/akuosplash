import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const clientes = await prisma.cliente.findMany({
    where: { estanquesJson: { not: null } },
    select: { nombre: true, estanquesJson: true }
  });
  console.log("Clientes con estanques:");
  for (const c of clientes) {
    console.log(`\n${c.nombre}:`);
    console.log("Raw:", c.estanquesJson);
    try {
      const est = JSON.parse(c.estanquesJson!);
      console.log("Parseado:", JSON.stringify(est, null, 2));
    } catch(e) {
      console.log("Error parseando:", e);
    }
  }
  if (clientes.length === 0) {
    console.log("NO HAY clientes con estanquesJson guardado!");
    const todos = await prisma.cliente.findMany({ select: { nombre: true, estanquesJson: true } });
    console.log("Todos los clientes:");
    for (const c of todos) {
      console.log(`  ${c.nombre}: estanquesJson = ${c.estanquesJson}`);
    }
  }
}
main().then(() => prisma.$disconnect());
