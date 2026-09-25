import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/restore-estanques?nombre=Shumaker
// Busca el cliente por nombre y restaura sus estanques:
// 1. Si ya tiene estanques, no hace nada
// 2. Si no tiene, busca en entregas anteriores (detalleEstanquesJson)
// 3. Si no encuentra en entregas, y el usuario pasó nombres, los crea
// GET /api/admin/restore-estanques?nombre=Shumaker&nombres=verde,bin,negro
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const nombreBusqueda = searchParams.get("nombre");
  const nombresParam = searchParams.get("nombres");

  if (!nombreBusqueda) {
    return NextResponse.json({ error: "Falta parametro: nombre" }, { status: 400 });
  }

  // Buscar el cliente por nombre (búsqueda parcial, case-insensitive manual)
  const nombreLower = nombreBusqueda.toLowerCase();
  const todosClientes = await db.cliente.findMany({
    where: { duenoId },
    select: { id: true, nombre: true, estanquesJson: true },
  });
  const clientes = todosClientes.filter(c => c.nombre.toLowerCase().includes(nombreLower));

  if (clientes.length === 0) {
    return NextResponse.json({ error: `No se encontró cliente con nombre "${nombreBusqueda}"` }, { status: 404 });
  }

  const resultados: any[] = [];

  for (const cliente of clientes) {
    // Verificar si ya tiene estanques
    let estanquesActuales: any[] = [];
    try {
      estanquesActuales = cliente.estanquesJson ? JSON.parse(cliente.estanquesJson) : [];
    } catch {
      estanquesActuales = [];
    }

    if (Array.isArray(estanquesActuales) && estanquesActuales.length > 0) {
      resultados.push({
        cliente: cliente.nombre,
        id: cliente.id,
        estado: "ya_tiene_estanques",
        estanques: estanquesActuales.map((e: any) => e.nombre || e.tipo),
      });
      continue;
    }

    // No tiene estanques — buscar en entregas anteriores
    const entregasConEstanques = await db.entrega.findMany({
      where: {
        duenoId,
        clienteId: cliente.id,
        detalleEstanquesJson: { not: null },
      },
      select: { detalleEstanquesJson: true, fecha: true },
      orderBy: { fecha: "desc" },
      take: 1,
    });

    let estanquesNuevos: any[] = [];

    if (entregasConEstanques.length > 0) {
      // Restaurar desde la entrega más reciente
      try {
        const estanques = JSON.parse(entregasConEstanques[0].detalleEstanquesJson || "[]");
        if (Array.isArray(estanques) && estanques.length > 0) {
          estanquesNuevos = estanques.map((est: any) => ({
            tipo: "estanque",
            capacidad: String(est.capacidad || ""),
            nombre: est.nombre || "",
            ubicacion: est.ubicacion || "",
            facturaSeparada: !!est.facturaSeparada,
          }));
        }
      } catch {}
    }

    // Si no encontró en entregas, usar los nombres del parámetro
    if (estanquesNuevos.length === 0 && nombresParam) {
      estanquesNuevos = nombresParam.split(",").map((n: string) => ({
        tipo: "estanque",
        capacidad: "",
        nombre: n.trim(),
        ubicacion: "",
        facturaSeparada: false,
      }));
    }

    if (estanquesNuevos.length > 0) {
      await db.cliente.update({
        where: { id: cliente.id },
        data: { estanquesJson: JSON.stringify(estanquesNuevos) },
      });
      resultados.push({
        cliente: cliente.nombre,
        id: cliente.id,
        estado: "restaurado",
        fuente: entregasConEstanques.length > 0 ? "entrega_anterior" : "nombres_parametro",
        estanques: estanquesNuevos.map((e: any) => e.nombre),
      });
    } else {
      resultados.push({
        cliente: cliente.nombre,
        id: cliente.id,
        estado: "no_se_pudo_restaurar",
        razon: "No se encontraron estanques en entregas anteriores ni en el parámetro nombres",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    resultados,
    message: `Procesados ${resultados.length} cliente(s).`,
  });
}
