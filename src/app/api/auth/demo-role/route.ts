// PATCH /api/auth/demo-role
// Cambia el rol del usuario demo (dueno ↔ chofer).
// Solo funciona si el usuario actual tiene isDemo=true.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar que el usuario sea demo
  const user = await db.usuario.findUnique({
    where: { id: session.userId },
    select: { isDemo: true, activo: true },
  });

  if (!user || !user.activo || !user.isDemo) {
    return NextResponse.json(
      { error: "Solo la cuenta de demostración puede cambiar de rol" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const newRole = body.role;

  if (newRole !== "dueno" && newRole !== "chofer") {
    return NextResponse.json({ error: "Rol inválido. Debe ser 'dueno' o 'chofer'" }, { status: 400 });
  }

  // Si cambia a chofer, necesita duenoId (su propio id, ya que es el admin demo)
  // Si cambia a dueno, duenoId queda en null
  const data: { role: string; duenoId: string | null } = { role: newRole, duenoId: null };
  if (newRole === "chofer") {
    // El admin demo se hace chofer de sí mismo
    data.duenoId = session.userId;
  }

  await db.usuario.update({
    where: { id: session.userId },
    data,
  });

  return NextResponse.json({ ok: true, role: newRole });
}
