import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { deleteInscription } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/oneclick/delete
// Desinscribe la tarjeta (invalida tbkUser para futuros cobros).
// No reembolsa cargos previos — para eso usar /cancel primero.
export async function POST(_req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const u = await akuosplashDb.akuoUsuario.findUnique({ where: { id: user.id } });
  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!u.tbkUser || !u.tbkUsername) {
    return NextResponse.json({ error: "No tienes tarjeta inscripta" }, { status: 400 });
  }

  try {
    await deleteInscription(u.tbkUsername, u.tbkUser);

    await akuosplashDb.akuoUsuario.update({
      where: { id: user.id },
      data: {
        tbkUser: null,
        tbkCardType: null,
        tbkCardLast4: null,
        tbkInscriptionStatus: "DELETED",
        tbkSubscriptionActive: false,
      },
    });

    return NextResponse.json({ ok: true, message: "Tarjeta desinscripta." });
  } catch (e: any) {
    console.error("[oneclick delete]", e);
    return NextResponse.json({ error: e.message || "No se pudo desinscribir la tarjeta" }, { status: 500 });
  }
}
