import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/vehiculos/[id]/choferes
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    const r = await client.execute({
      sql: `SELECT vc.id, vc.vehiculoId, vc.choferId, vc.asignadoEn,
                   u.nombre as choferNombre, u.email as choferEmail, u.telefono as choferTelefono
            FROM AkuoVehiculoChofer vc
            LEFT JOIN AkuoUsuario u ON vc.choferId = u.id
            WHERE vc.vehiculoId = ?`,
      args: [id],
    });
    return NextResponse.json({
      choferes: r.rows.map((row: any) => ({
        id: row.id,
        choferId: row.choferId,
        nombre: row.choferNombre,
        email: row.choferEmail,
        telefono: row.choferTelefono,
        asignadoEn: row.asignadoEn,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

// POST /api/akuosplash/vehiculos/[id]/choferes
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (!body.choferId) {
    return NextResponse.json({ error: "choferId es obligatorio" }, { status: 400 });
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    const existing = await client.execute({
      sql: "SELECT id FROM AkuoVehiculoChofer WHERE vehiculoId = ? AND choferId = ?",
      args: [id, body.choferId],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ ok: true, yaAsignado: true });
    }

    const assignId = `avc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await client.execute({
      sql: "INSERT INTO AkuoVehiculoChofer (id, vehiculoId, choferId, asignadoEn) VALUES (?, ?, ?, ?)",
      args: [assignId, id, body.choferId, new Date().toISOString()],
    });

    return NextResponse.json({ ok: true, id: assignId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

// DELETE /api/akuosplash/vehiculos/[id]/choferes?choferId=X
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const choferId = searchParams.get("choferId");

  if (!choferId) {
    return NextResponse.json({ error: "choferId es obligatorio" }, { status: 400 });
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    await client.execute({
      sql: "DELETE FROM AkuoVehiculoChofer WHERE vehiculoId = ? AND choferId = ?",
      args: [id, choferId],
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
