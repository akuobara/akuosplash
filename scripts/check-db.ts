// Script temporal para inspeccionar la base de datos
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("=== VUELTAS (activa y recientes) ===");
  const vueltas = await db.vuelta.findMany({
    take: 5,
    orderBy: { iniciadaEn: "desc" },
    include: {
      _count: { select: { entregas: true } },
      camion: { select: { nombre: true, capacidad: true } },
      entregas: { select: { id: true, litros: true, clienteNombre: true, fecha: true } },
    },
  });
  for (const v of vueltas) {
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    console.log(`Vuelta #${v.numero} activa=${v.activa} litros=${litros} entregas=${v._count.entregas} camion=${v.camion?.nombre}`);
    for (const e of v.entregas) {
      console.log(`  - ${e.clienteNombre} ${e.litros}L ${e.fecha.toISOString()}`);
    }
  }

  console.log("\n=== PEDIDOS (recientes) ===");
  const pedidos = await db.pedido.findMany({
    take: 10,
    orderBy: { creadoEn: "desc" },
    select: {
      id: true,
      clienteNombre: true,
      litrosSolicitados: true,
      estado: true,
      entregaId: true,
      vueltaId: true,
      creadoEn: true,
    },
  });
  for (const p of pedidos) {
    console.log(`Pedido ${p.id.substring(0, 8)} ${p.clienteNombre} ${p.litrosSolicitados}L estado=${p.estado} entregaId=${p.entregaId ?? "null"} vueltaId=${p.vueltaId ?? "null"}`);
  }

  console.log("\n=== ENTREGAS (recientes) ===");
  const entregas = await db.entrega.findMany({
    take: 10,
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      clienteNombre: true,
      litros: true,
      total: true,
      fecha: true,
      vueltaId: true,
    },
  });
  for (const e of entregas) {
    console.log(`Entrega ${e.id.substring(0, 8)} ${e.clienteNombre} ${e.litros}L total=${e.total} vueltaId=${e.vueltaId ?? "null"} ${e.fecha.toISOString()}`);
  }
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
