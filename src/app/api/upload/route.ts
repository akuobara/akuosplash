import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// POST /api/upload
// Sube un archivo a Cloudflare R2 (compatible con S3) y devuelve la URL pública.
// Requiere las env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx 10MB)" }, { status: 413 });
    }

    // Generar nombre único
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Configurar cliente R2 (S3-compatible)
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || "akuosplash-uploads";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: "R2 no configurado. Faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY" },
        { status: 500 }
      );
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    // Leer el archivo como buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    // URL pública del archivo
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${filename}`
      : `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${filename}`;

    return NextResponse.json({ url: publicUrl, uploadedToServer: true });
  } catch (e: any) {
    console.error("[upload] Error:", e?.message);
    return NextResponse.json(
      { error: e?.message || "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
