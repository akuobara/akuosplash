import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// PUT /api/akuosplash/integraciones/mercadopago-split
// Body: { accessToken?, publicKey?, userId? }
// Persiste las credenciales de la cuenta MP para SPLIT del marketplace
// (cliente paga por agua → MP divide entre plataforma y transportista).
// Una sola cuenta para todos los planes (la comisión la calcula el backend de AkuoSplash).
export async function PUT(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const body = await req.json();
  const data: any = {};
  if (body.accessToken) data.mpSplitAccessToken = body.accessToken;
  if (body.publicKey) data.mpSplitPublicKey = body.publicKey;
  if (body.userId) data.mpSplitUserId = body.userId;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar" }, { status: 400 });
  }

  // Leer el id del config activo (raw SQL para evitar problemas con columnas legacy)
  const existing: any = await akuosplashDb.$queryRawUnsafe(`SELECT id FROM AkuoConfig WHERE activo = 1 LIMIT 1`).catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    const id = existing[0].id;
    const fields = Object.keys(data);
    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => data[f]);
    values.push(id);
    await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoConfig SET ${setClause} WHERE id = ?`, ...values);
  } else {
    // Crear row nuevo
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
