import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/global/buscar?q=X
// Busca en TODOS los admins: clientes, choferes, camiones por nombre/teléfono/email
export async function GET(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ resultados: { clientes: [], choferes: [], camiones: [], admins: [] } });
  }

  try {
    const [clientes, choferes, camiones, admins] = await Promise.all([
      db.cliente.findMany({
        where: {
          OR: [
            { nombre: { contains: q } },
            { telefono: { contains: q } },
            { rut: { contains: q } },
            { email: { contains: q } },
            { direccion: { contains: q } },
            { zona: { contains: q } },
          ],
        },
        select: {
          id: true, nombre: true, telefono: true, rut: true, email: true, zona: true, direccion: true,
          dueno: { select: { id: true, nombre: true, email: true } },
          _count: { select: { entregas: true } },
        },
        take: 50,
      }),
      db.usuario.findMany({
        where: {
          role: "chofer",
          OR: [
            { nombre: { contains: q } },
            { email: { contains: q } },
            { telefono: { contains: q } },
          ],
        },
        select: {
          id: true, nombre: true, email: true, telefono: true, activo: true,
          dueno: { select: { id: true, nombre: true } },
        },
        take: 30,
      }),
      db.camion.findMany({
        where: {
          OR: [
            { nombre: { contains: q } },
            { patente: { contains: q } },
          ],
        },
        select: {
          id: true, nombre: true, patente: true, capacidad: true, activo: true,
          dueno: { select: { id: true, nombre: true } },
        },
        take: 30,
      }),
      db.usuario.findMany({
        where: {
          role: "dueno",
          OR: [
            { nombre: { contains: q } },
            { email: { contains: q } },
            { telefono: { contains: q } },
          ],
        },
        select: { id: true, nombre: true, email: true, telefono: true, activo: true },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      resultados: {
        clientes,
        choferes,
        camiones,
        admins,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error en la búsqueda" }, { status: 500 });
  }
}
