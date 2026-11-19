import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { startInscription, generateOneclickUsername } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/oneclick/start
// Inicia la inscripción de tarjeta Oneclick.
// Devuelve { url, token } — el frontend redirige al usuario a `url` (form POST con tbk_token).
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = body.email || user.email || `${user.id}@akuosplash.cl`;
  const username = generateOneclickUsername(user.id);
  // URL pública a la que Transbank redirige tras inscribir la tarjeta
  const responseUrl = "https://akuosplash.cl/api/akuosplash/subscription/transbank/oneclick/finish";

  try {
    const result = await startInscription({ username, responseUrl, email });

    // Guardar el token de inscripción pendiente
    await akuosplashDb.akuoUsuario.update({
      where: { id: user.id },
      data: {
        tbkUsername: username,
        tbkInscriptionToken: result.token,
        tbkInscriptionStatus: "INITIALIZED",
        tbkInscriptionEmail: email,
      },
    });

    return NextResponse.json({ url: result.url, token: result.token });
  } catch (e: any) {
    console.error("[oneclick start]", e);
    return NextResponse.json({ error: e.message || "No se pudo iniciar la inscripción" }, { status: 500 });
  }
}
