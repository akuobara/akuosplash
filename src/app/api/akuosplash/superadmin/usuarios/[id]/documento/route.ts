import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { createClient } from "@libsql/client";

// PATCH /api/akuosplash/superadmin/usuarios/[id]/documento
// Actualiza el estado de aprobación de un documento específico
// Body: { tipoDocumento: "licenciaConducirUrl", estado: "aprobado"|"rechazado"|"pendiente", nota?: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { tipoDocumento, estado, nota } = body;

  if (!tipoDocumento || !["aprobado", "rechazado", "pendiente"].includes(estado)) {
    return NextResponse.json({ error: "tipoDocumento y estado son obligatorios" }, { status: 400 });
  }

  // Usar libsql directo (Prisma $queryRawUnsafe falla en Render)
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    // Leer el JSON actual
    const r = await client.execute({
      sql: "SELECT documentosAprobacionJson FROM AkuoUsuario WHERE id = ?",
      args: [id],
    });
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const raw = r.rows[0].documentosAprobacionJson as string | null;
    let docs: Record<string, { estado: string; nota?: string }> = {};
    try { docs = raw ? JSON.parse(raw) : {}; } catch {}

    // Actualizar el documento específico
    docs[tipoDocumento] = { estado, nota: nota || undefined };

    // Guardar
    await client.execute({
      sql: "UPDATE AkuoUsuario SET documentosAprobacionJson = ? WHERE id = ?",
      args: [JSON.stringify(docs), id],
    });

    return NextResponse.json({ ok: true, tipoDocumento, estado, docs });
  } catch (e: any) {
    console.error("[documento PATCH] Error:", e?.message);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
