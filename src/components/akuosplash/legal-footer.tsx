"use client";

import Link from "next/link";

// Footer con links legales para las interfaces de cliente y transportista
export function LegalFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white mt-8">
      <div className="mx-auto max-w-md px-4 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <span>© {new Date().getFullYear()} AkuoSplash</span>
          <span className="text-gray-200">·</span>
          <Link href="/akuosplash/terminos" className="hover:text-blue-600 hover:underline" target="_blank">Términos y Condiciones</Link>
          <span className="text-gray-200">·</span>
          <Link href="/akuosplash/privacidad" className="hover:text-blue-600 hover:underline" target="_blank">Privacidad</Link>
          <span className="text-gray-200">·</span>
          <Link href="/akuosplash/empresa" className="hover:text-blue-600 hover:underline" target="_blank">Empresa</Link>
          <span className="text-gray-200">·</span>
          <a href="mailto:contacto@akuosplash.cl" className="hover:text-blue-600 hover:underline">Contacto</a>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-1">
          AkuoSplash es una marca de Akuologistic SpA
        </p>
      </div>
    </footer>
  );
}
