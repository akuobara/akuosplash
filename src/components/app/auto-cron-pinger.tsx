"use client";

import { useEffect } from "react";

/**
 * Componente invisible que pingea el endpoint /api/cron/generar-recurrentes
 * cada hora mientras la app está abierta en algún browser.
 *
 * Esto es un WORKAROUND para cuando no hay un cron externo (Vercel Cron, cron-job.org, etc.)
 * llamando al endpoint diario.
 *
 * En producción idealmente configurar un cron externo que llame:
 *   GET https://tu-dominio/api/cron/generar-recurrentes
 * y eliminar este componente.
 */
export function AutoCronPinger() {
  useEffect(() => {
    // Ping inmediato al montar (solo si estamos en browser)
    if (typeof window === "undefined") return;

    const pingCron = () => {
      fetch("/api/cron/generar-recurrentes", {
        method: "GET",
        cache: "no-store",
      }).catch(() => {
        // Silenciar errores — es un ping de fondo, no debe mostrar nada al usuario
      });
    };

    // Ping inmediato (espera 10s para no competir con el login/initial load)
    const initialTimer = setTimeout(pingCron, 10000);

    // Ping cada 1 hora
    const interval = setInterval(pingCron, 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // No renderiza nada
  return null;
}
