#!/usr/bin/env bash
# Separar AkuoSplash en su propio proyecto Next.js independiente.
# NO toca /home/z/my-project/ (AljibeApp queda intacta).
# Crea /home/z/my-project-akuosplash/ con copia limpia de todo lo que AkuoSplash necesita.

set -euo pipefail

SRC="/home/z/my-project"
DST="/home/z/my-project-akuosplash"

echo "==> [1/10] Creando destino $DST"
mkdir -p "$DST"

echo "==> [2/10] Copiando configs raíz"
cp "$SRC/package.json"        "$DST/package.json"
cp "$SRC/next.config.ts"      "$DST/next.config.ts"
cp "$SRC/tsconfig.json"       "$DST/tsconfig.json"
cp "$SRC/tailwind.config.ts"  "$DST/tailwind.config.ts"
cp "$SRC/postcss.config.mjs"  "$DST/postcss.config.mjs"
cp "$SRC/components.json"      "$DST/components.json"
cp "$SRC/next-env.d.ts"       "$DST/next-env.d.ts"
cp "$SRC/eslint.config.mjs"   "$DST/eslint.config.mjs"
# .gitignore
if [ -f "$SRC/.gitignore" ]; then cp "$SRC/.gitignore" "$DST/.gitignore"; fi

echo "==> [3/10] Copiando prisma/schema-akuosplash.prisma -> prisma/schema.prisma"
mkdir -p "$DST/prisma"
cp "$SRC/prisma/schema-akuosplash.prisma" "$DST/prisma/schema.prisma"
# En el nuevo proyecto, el schema es el único. Ajustamos el output del generator
# para que apunte a src/generated/client (sin el prefijo akuosplash-).
# NOTA: dejamos el output original para que el código de src/lib/akuosplash-db.ts
# siga funcionando sin tener que editarlo.

echo "==> [4/10] Copiando src/generated/akuosplash-client/"
mkdir -p "$DST/src/generated"
cp -r "$SRC/src/generated/akuosplash-client" "$DST/src/generated/akuosplash-client"

echo "==> [5/10] Copiando src/lib/akuosplash-*.ts + libs compartidas"
mkdir -p "$DST/src/lib"
cp "$SRC"/src/lib/akuosplash-*.ts "$DST/src/lib/"
# Libs compartidas que AkuoSplash importa
cp "$SRC/src/lib/utils.ts"            "$DST/src/lib/utils.ts"
cp "$SRC/src/lib/google-maps.ts"      "$DST/src/lib/google-maps.ts"
cp "$SRC/src/lib/precio-dinamico.ts"  "$DST/src/lib/precio-dinamico.ts"

echo "==> [6/10] Copiando src/components/ui/ (15 componentes que AkuoSplash usa)"
mkdir -p "$DST/src/components/ui"
for c in badge button card checkbox dialog dropdown-menu input label select separator skeleton sonner switch tabs textarea; do
  if [ -f "$SRC/src/components/ui/$c.tsx" ]; then
    cp "$SRC/src/components/ui/$c.tsx" "$DST/src/components/ui/$c.tsx"
  fi
done

echo "==> [7/10] Copiando src/components/akuosplash/"
mkdir -p "$DST/src/components"
cp -r "$SRC/src/components/akuosplash" "$DST/src/components/akuosplash"

echo "==> [8/10] Copiando src/app/akuosplash/ + src/app/api/akuosplash/ + src/data/"
mkdir -p "$DST/src/app" "$DST/src/app/api" "$DST/src/data"
cp -r "$SRC/src/app/akuosplash" "$DST/src/app/akuosplash"
cp -r "$SRC/src/app/api/akuosplash" "$DST/src/app/api/akuosplash"
cp "$SRC/src/data/chile-comunas-metadata.json" "$DST/src/data/chile-comunas-metadata.json"
cp "$SRC/src/data/chile-localidades.json"      "$DST/src/data/chile-localidades.json"

echo "==> [9/10] Copiando public/akuosplash/"
mkdir -p "$DST/public"
cp -r "$SRC/public/akuosplash" "$DST/public/akuosplash"

echo "==> [10/10] Creando src/app/layout.tsx, page.tsx, globals.css raíz del nuevo proyecto"
cp "$SRC/src/app/globals.css" "$DST/src/app/globals.css"

# Layout raíz para AkuoSplash (simplificado del de Aljibe pero adaptado)
cat > "$DST/src/app/layout.tsx" <<'LAYOUT_EOF'
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AkuoSplash — Reparto de agua a domicilio",
  description: "Pedí agua a domicilio en Chile. Reparto de agua potable para tu casa, piscina o negocio.",
  keywords: ["reparto de agua", "agua a domicilio", "akuosplash", "camión aljibe", "agua potable"],
  authors: [{ name: "AkuoSplash" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
LAYOUT_EOF

# Root page → redirect a /akuosplash
cat > "$DST/src/app/page.tsx" <<'PAGE_EOF'
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/akuosplash");
}
PAGE_EOF

echo ""
echo "=========================================="
echo "✅ Separación física completada en: $DST"
echo "=========================================="
echo ""
echo "Resumen de lo copiado:"
echo " - configs raíz (package.json, next.config.ts, tsconfig.json, etc)"
echo " - prisma/schema.prisma (renombrado desde schema-akuosplash.prisma)"
echo " - src/generated/akuosplash-client/ (cliente Prisma ya generado)"
echo " - src/lib/akuosplash-*.ts (7 archivos)"
echo " - src/lib/utils.ts + src/lib/google-maps.ts + src/lib/precio-dinamico.ts"
echo " - src/components/ui/ (15 componentes shadcn usados)"
echo " - src/components/akuosplash/ (~53 archivos)"
echo " - src/app/akuosplash/ (todas las páginas)"
echo " - src/app/api/akuosplash/ (todas las rutas API)"
echo " - src/data/chile-comunas-metadata.json + chile-localidades.json"
echo " - public/akuosplash/ (logo y assets)"
echo " - src/app/layout.tsx + src/app/page.tsx + globals.css nuevos"
echo ""
echo "NO se modificó ni borró nada en $SRC (AljibeApp)."
