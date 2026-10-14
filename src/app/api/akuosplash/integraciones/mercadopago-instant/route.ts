import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

// PUT /api/akuosplash/integraciones/mercadopago-instant
// Body: { accessToken?, publicKey?, userId? }
// Persiste las credenciales de la cuenta MP con liberación inmediata (Plan Pro).
export async function PUT(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  if (body.accessToken) data.mpInstantAccessToken = body.accessToken;
  if (body.publicKey) data.mpInstantPublicKey = body.publicKey;
  if (body.userId) data.mpInstantUserId = body.userId;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar" }, { status: 400 });
  }

  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config) {
    await akuosplashDb.akuoConfig.create({ data: { activo: true, ...data } });
  } else {
    await akuosplashDb.akuoConfig.update({ where: { id: config.id }, data });
  }

  return NextResponse.json({ ok: true });
}
