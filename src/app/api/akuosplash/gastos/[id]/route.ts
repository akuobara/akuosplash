import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// DELETE /api/akuosplash/gastos/[id] — eliminar gasto
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  const gasto = await akuosplashDb.akuoGasto.findUnique({ where: { id } });
  if (!gasto || gasto.transportistaId !== user.id) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await akuosplashDb.akuoGasto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
