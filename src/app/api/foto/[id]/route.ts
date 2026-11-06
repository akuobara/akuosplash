import { NextRequest, NextResponse } from "next/server";

// GET /api/foto/[id]
// Sirve una foto almacenada en la tabla Foto (base64 en Turso DB)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Usar libsql directo (bypass Prisma que puede fallar)
  const { createClient } = await import("@libsql/client");
  const url = process.env.DATABASE_URL || process.env.AKUOSPLASH_DATABASE_URL || "";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });

  try {
    const r = await client.execute({ sql: "SELECT data, contentType FROM Foto WHERE id = ?", args: [id] });
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }
    const row = r.rows[0] as any;
    const data = row.data as string;

    // Si es base64 data URL, devolver directamente
    if (data.startsWith("data:")) {
      const match = data.match(/^data:(.+?);base64,(.*)$/);
      if (match) {
        const contentType = match[1];
        const base64 = match[2];
        const buffer = Buffer.from(base64, "base64");
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // Fallback: devolver como texto
    return new NextResponse(data, {
      headers: { "Content-Type": (row.contentType as string) || "image/jpeg" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error al obtener foto" }, { status: 500 });
  }
}
