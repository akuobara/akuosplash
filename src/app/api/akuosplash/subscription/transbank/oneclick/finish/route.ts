import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { finishInscription } from "@/lib/akuosplash-transbank";

// GET /api/akuosplash/subscription/transbank/oneclick/finish
// Transbank redirige acá después de que el usuario inscribe (o cancela) su tarjeta.
// Query params: tbk_token (si inscribió) | TBK_TOKEN (alt) — si no hay, el usuario abortó.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("tbk_token") || url.searchParams.get("TBK_TOKEN");

  // Render resuelve url.origin al hostname interno (srv-xxx:10000); usar el dominio público.
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const origin = fwdHost && !fwdHost.startsWith("srv-") ? `https://${fwdHost}` : "https://akuosplash.cl";

  if (!token) {
    // Usuario abortó la inscripción
    return NextResponse.redirect(
      new URL("/akuosplash/transportista?tab=subscripcion&oneclick=abortado", origin)
    );
  }

  // Buscar al usuario por el token de inscripción pendiente
  const usuario = await akuosplashDb.akuoUsuario.findFirst({
    where: { tbkInscriptionToken: token },
  });
  if (!usuario) {
    return NextResponse.redirect(
      new URL("/akuosplash/transportista?tab=subscripcion&oneclick=error&msg=token_no_encontrado", origin)
    );
  }

  try {
    const result = await finishInscription(token);

    if (result.responseCode === 0) {
      // Inscripción exitosa — guardar tbkUser + datos de tarjeta
      await akuosplashDb.akuoUsuario.update({
        where: { id: usuario.id },
        data: {
          tbkUser: result.tbkUser,
          tbkCardType: result.cardType,
          tbkCardLast4: result.cardNumber,
          tbkInscriptionStatus: "COMPLETED",
        },
      });
      return NextResponse.redirect(
        new URL("/akuosplash/transportista?tab=subscripcion&oneclick=ok", origin)
      );
    } else {
      await akuosplashDb.akuoUsuario.update({
        where: { id: usuario.id },
        data: { tbkInscriptionStatus: "FAILED" },
      }).catch(() => {});
      return NextResponse.redirect(
        new URL(`/akuosplash/transportista?tab=subscripcion&oneclick=fallido&rc=${result.responseCode}`, origin)
      );
    }
  } catch (e: any) {
    console.error("[oneclick finish]", e);
    await akuosplashDb.akuoUsuario.update({
      where: { id: usuario.id },
      data: { tbkInscriptionStatus: "ERROR" },
    }).catch(() => {});
    return NextResponse.redirect(
      new URL(`/akuosplash/transportista?tab=subscripcion&oneclick=error&msg=${encodeURIComponent(e.message || "")}`, origin)
    );
  }
}
