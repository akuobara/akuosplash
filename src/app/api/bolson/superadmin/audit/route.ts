// GET /api/bolson/superadmin/audit — lista últimos audit logs
import { NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET() {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const logs = await bolsonDb.bolsonAuditLog.findMany({
    orderBy: { creadoEn: "desc" },
    include: { superadmin: { select: { id: true, nombre: true } } },
    take: 100,
  });

  return NextResponse.json({ logs });
}
