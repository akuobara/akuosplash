import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { commitTransaction } from "@/lib/akuosplash-transbank";

// GET /api/akuosplash/subscription/transbank/return
// Transbank redirige acá después de que el usuario paga o cancela.
// Query params: token_ws (siempre), TBK_TOKEN (alternativo), TBK_ORDEN_COMPRA, TBK_ID_SESION
// Si NO hay token_ws → el usuario abortó (cerró la ventana).
// Si hay token_ws → hay que hacer commit para confirmar.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenWs = url.searchParams.get("token_ws") || url.searchParams.get("TBK_TOKEN");

  // IMPORTANTE: url.origin dentro de Render resuelve al hostname INTERNO
  // (srv-xxx-yyy:10000), no al dominio público. Usar el host forwarded (akuosplash.cl)
  // con fallback al dominio de producción.
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const origin = fwdHost && !fwdHost.startsWith("srv-") ? `https://${fwdHost}` : "https://akuosplash.cl";

  if (!tokenWs) {
    // Usuario abortó
    return NextResponse.redirect(
      new URL("/akuosplash/transportista?tab=subscripcion&transbank=abortado", origin)
    );
  }

  // Buscar el usuario por el token_ws (debería estar guardado en AkuoUsuario.transbankTokenWs)
  const usuario = await akuosplashDb.akuoUsuario.findFirst({
    where: { transbankTokenWs: tokenWs },
  });

  if (!usuario) {
    return NextResponse.redirect(
      new URL("/akuosplash/transportista?tab=subscripcion&transbank=error&msg=token_no_encontrado", origin)
    );
  }

  // Hacer el commit
  try {
    const commit = await commitTransaction(tokenWs);

    if (commit.status === "AUTHORIZED") {
      // Pago exitoso — activar el plan
      const planSolicitado = usuario.transbankPlanSolicitado || "pro";
      const ciclo = usuario.transbankCiclo || "mensual";
      const ahora = new Date();
      const hasta = new Date(ahora);
      if (ciclo === "anual") {
        hasta.setFullYear(hasta.getFullYear() + 1);
      } else {
        hasta.setMonth(hasta.getMonth() + 1);
      }

      await akuosplashDb.akuoUsuario.update({
        where: { id: usuario.id },
        data: {
          plan: planSolicitado,
          planActivoDesde: ahora,
          planActivoHasta: hasta,
          transbankStatus: "AUTHORIZED",
          transbankAutorizadoEn: ahora,
          transbankAuthorizationCode: commit.authorization_code,
        },
      });

      return NextResponse.redirect(
        new URL(`/akuosplash/transportista?tab=subscripcion&transbank=ok&plan=${planSolicitado}`, origin)
      );
    } else {
      // Falló
      await akuosplashDb.akuoUsuario.update({
        where: { id: usuario.id },
        data: {
          transbankStatus: commit.status || "FAILED",
        },
      });
      return NextResponse.redirect(
        new URL(`/akuosplash/transportista?tab=subscripcion&transbank=fallido&status=${commit.status}&rc=${commit.response_code ?? ""}`, origin)
      );
    }
  } catch (e: any) {
    console.error("[transbank return]", e);
    await akuosplashDb.akuoUsuario.update({
      where: { id: usuario.id },
      data: { transbankStatus: "ERROR" },
    }).catch(() => {});
    return NextResponse.redirect(
      new URL(`/akuosplash/transportista?tab=subscripcion&transbank=error&msg=${encodeURIComponent(e.message || "")}`, origin)
    );
  }
}
