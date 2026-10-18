import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// PUT /api/akuosplash/integraciones/mercadopago-sub
// Body: { accessToken?, publicKey? }
// Persiste las credenciales de la cuenta MP para SUBSCRIPTIONS
// (transportista paga por su plan mensual/anual via preapproval API).
export async function PUT(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const body = await req.json();
  const data: any = {};
  if (body.accessToken) data.mpSubAccessToken = body.accessToken;
  if (body.publicKey) data.mpSubPublicKey = body.publicKey;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar" }, { status: 400 });
  }

  const existing: any = await akuosplashDb.$queryRawUnsafe(`SELECT id FROM AkuoConfig WHERE activo = 1 LIMIT 1`).catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    const id = existing[0].id;
    const fields = Object.keys(data);
    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => data[f]);
    values.push(id);
    await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoConfig SET ${setClause} WHERE id = ?`, ...values);
  } else {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => "?").join(", ");
    const values = fields.map(f => data[f]);
    await akuosplashDb.$executeRawUnsafe(
      `INSERT INTO AkuoConfig (id, creadoEn, comisionPorcentaje, activo, ${fields.join(", ")}) VALUES (?, ?, 0, 1, ${placeholders})`,
      `cfg_${Date.now()}`, new Date().toISOString(), ...values
    );
  }

  return NextResponse.json({ ok: true });
}
