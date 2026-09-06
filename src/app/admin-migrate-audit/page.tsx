"use client";
import { useEffect, useState } from "react";

export default function AdminMigrateAuditPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "needs-login">("loading");
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/migrate-audit", {
          method: "POST",
          credentials: "include",
        });
        const d = await res.json();
        if (res.ok) {
          setStatus("ok");
          setData(d);
          setMsg("Migración de auditoría ejecutada.");
        } else if (res.status === 401) {
          setStatus("needs-login");
          setMsg("Necesitás iniciar sesión primero.");
        } else {
          setStatus("error");
          setMsg(d.error || "Error desconocido");
        }
      } catch (e) {
        setStatus("error");
        setMsg(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Migración: tabla de auditoría</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Crea la tabla <code>AuditLog</code> y sus índices en la base de datos de producción.
      </p>

      {status === "loading" && <p>Ejecutando…</p>}

      {status === "ok" && (
        <div style={{ padding: "1rem", background: "#dcfce7", border: "1px solid #16a34a", borderRadius: "8px", color: "#15803d" }}>
          <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>✅ {msg}</p>
          {data?.results && (
            <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
              {data.results.map((r: any, i: number) => (
                <li key={i}>
                  <code>{r.step}</code>: {r.status}
                  {r.error && <span style={{ color: "#dc2626" }}> — {r.error}</span>}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "1rem" }}>
            <a href="/" style={{ color: "#15803d", fontWeight: "bold" }}>← Volver a la app</a>
          </p>
        </div>
      )}

      {status === "needs-login" && (
        <div style={{ padding: "1rem", background: "#fef3c7", border: "1px solid #d97706", borderRadius: "8px", color: "#92400e" }}>
          {msg}
          <p style={{ marginTop: "1rem" }}>
            <a href="/" style={{ color: "#92400e", fontWeight: "bold" }}>← Iniciar sesión</a>
          </p>
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: "1rem", background: "#fee2e2", border: "1px solid #dc2626", borderRadius: "8px", color: "#991b1b" }}>
          Error: {msg}
        </div>
      )}
    </div>
  );
}
