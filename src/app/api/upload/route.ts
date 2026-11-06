import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// POST /api/upload
// Guarda la foto en la tabla Foto (Turso DB) como base64.
// Devuelve una URL pública: /api/foto/<id>
// No requiere servicios externos (Vercel Blob, R2, etc.) — funciona en cualquier hosting.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validar tamaño (máx 2MB — base64 ocupa ~33% más, y Turso tiene límite de 1MB por fila)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx 2MB). La app ya comprime las imágenes antes de subir." }, { status: 413 });
    }

    // Leer el archivo como base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const contentType = file.type || "image/jpeg";
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Generar ID único
    const fotoId = crypto.randomBytes(12).toString("hex");

    // Guardar en Turso (libsql directo — bypass Prisma)
    const { createClient } = await import("@libsql/client");
    const dbUrl = process.env.DATABASE_URL || process.env.AKUOSPLASH_DATABASE_URL || "";
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    const client = createClient({ url: dbUrl, authToken });

    await client.execute({
      sql: "INSERT INTO Foto (id, data, contentType, creadoEn) VALUES (?, ?, ?, ?)",
      args: [fotoId, dataUrl, contentType, new Date().toISOString()],
    });

    // Construir URL pública
    // En Render: https://aljibeapp.onrender.com/api/foto/<id>
    // En localhost: http://localhost:3000/api/foto/<id>
    const origin = req.nextUrl.origin;
    const publicUrl = `${origin}/api/foto/${fotoId}`;

    return NextResponse.json({ url: publicUrl, uploadedToServer: true, fotoId });
  } catch (e: any) {
    console.error("[upload] Error:", e?.message);
    return NextResponse.json(
      { error: e?.message || "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
