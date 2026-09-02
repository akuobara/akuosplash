import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/planes — lista todos los planes
export async function GET() {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const planes = await db.plan.findMany({
    orderBy: { precioMensual: "asc" },
    include: { _count: { select: { configuraciones: true } } },
  });
  return NextResponse.json({ planes });
}
