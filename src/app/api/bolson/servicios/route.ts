// GET /api/bolson/servicios?mias=1 — lista mis servicios
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mias = searchParams.get("mias") === "1";
  const estado = searchParams.get("estado");

  const where: any = {};
  if (mias) {
    if (user.rol === "transportista") where.OR = [{ transportistaId: user.id }, { choferId: user.id }];
    else if (user.rol === "cliente") {
      where.solicitud = { clienteId: user.id };
    } else if (user.rol === "superadmin") {
      // ve todos
    }
  }
  if (estado) where.estado = estado;

  const servicios = await bolsonDb.bolsonServicio.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    include: {
      solicitud: {
        select: {
          id: true, titulo: true, categoria: true,
          cliente: { select: { id: true, nombre: true, telefono: true } },
          puntos: { orderBy: { orden: "asc" } },
        },
      },
      cotizacion: { select: { id: true, monto: true } },
      transportista: { select: { id: true, nombre: true, telefono: true, patenteCamion: true, capacidadCamionKg: true } },
      chofer: { select: { id: true, nombre: true, telefono: true } },
      fotos: { orderBy: { creadoEn: "asc" } },
      pagos: { orderBy: { creadoEn: "desc" } },
    },
    take: 100,
  });

  return NextResponse.json({ servicios });
}
