import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// POST /api/upload
// Sube un archivo a Vercel Blob y devuelve la URL pública.
// Usado por uploadFile() en lib/api-client.ts para fotos de clientes, estanques, licencias, etc.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validar tamaño (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx 10MB)" }, { status: 413 });
    }

    // Generar nombre único con prefijo de fecha
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Subir a Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type || undefined,
    });

    return NextResponse.json({ url: blob.url, uploadedToServer: true });
  } catch (e: any) {
    console.error("[upload] Error:", e?.message);
    return NextResponse.json(
      { error: e?.message || "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
