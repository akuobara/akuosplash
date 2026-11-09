import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

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
    return NextResponse.json({ error: "tipoDocumento y estado (aprobado/rechazado/pendiente) son obligatorios" }, { status: 400 });
  }

  try {
    // Leer el JSON actual
    const r: any = await akuosplashDb.$queryRawUnsafe(
      "SELECT documentosAprobacionJson FROM AkuoUsuario WHERE id = ?",
      id
    );
    if (!Array.isArray(r) || r.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const raw = r[0].documentosAprobacionJson;
    let docs: Record<string, { estado: string; nota?: string }> = {};
    try { docs = raw ? JSON.parse(raw) : {}; } catch {}

    // Actualizar el documento específico
    docs[tipoDocumento] = { estado, nota: nota || undefined };

    // Guardar
    await akuosplashDb.$executeRawUnsafe(
      "UPDATE AkuoUsuario SET documentosAprobacionJson = ? WHERE id = ?",
      JSON.stringify(docs), id
    );

    return NextResponse.json({ ok: true, tipoDocumento, estado, docs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
