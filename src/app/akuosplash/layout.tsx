import type { Metadata } from "next";
import { Toaster as SonnerToaster } from "sonner";

export const metadata: Metadata = {
  title: "AkuoSplash — Reparto de agua a domicilio",
  description: "Pedí agua a domicilio en Chile. Reparto de agua potable para tu casa, piscina o negocio.",
  keywords: ["reparto de agua", "agua a domicilio", "akuosplash", "camión aljibe", "agua potable"],
  authors: [{ name: "AkuoSplash" }],
};

export default function AkuosplashLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="akuosplash-app">
      {children}
      <SonnerToaster richColors position="top-center" />
    </div>
  );
}
