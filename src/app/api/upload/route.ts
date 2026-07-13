import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// POST /api/upload — sube una imagen (licencia, documento del camión, foto de gasto, etc.)
// Solo usuarios autenticados pueden subir archivos.
// Retorna { url } con la URL pública del archivo.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Tipo de archivo no permitido. Solo imágenes." }, { status: 400 });
    }

    // Validar tamaño (máx 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx 10MB)" }, { status: 400 });
    }

    // Generar nombre único
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext) ? ext : "jpg";
    const randomName = `${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt}`;

    // Asegurar que el directorio exista
    const uploadDir = join(process.cwd(), "public", "uploads");
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {
      // El directorio ya existe
    }

    // Guardar el archivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, randomName);
    await writeFile(filePath, buffer);

    // Retornar URL pública
    const url = `/uploads/${randomName}`;
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error("Error en upload:", err);
    return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 500 });
  }
}
