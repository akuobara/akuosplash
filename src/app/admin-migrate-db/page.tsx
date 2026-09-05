"use client";
import { useEffect, useState } from "react";

export default function AdminMigrateDbPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "needs-login">("loading");
  const [results, setResults] = useState<{ column: string; status: string; error?: string }[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/migrate-db", {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setStatus("ok");
          setResults(data.results || []);
          setMsg("Migración ejecutada.");
        } else if (res.status === 401) {
          setStatus("needs-login");
          setMsg("Necesitás iniciar sesión como administrador primero.");
        } else {
          setStatus("error");
          setMsg(data.error || "Error desconocido");
        }
      } catch (e) {
        setStatus("error");
        setMsg(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div style={{
      fontFamily: "system-ui, sans-serif",
      padding: "2rem",
      maxWidth: "600px",
      margin: "0 auto",
    }}>
      <h1>Migración de base de datos</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Este script agrega columnas faltantes a la base de datos de producción.
      </p>

      {status === "loading" && <p>Ejecutando migración…</p>}

      {status === "ok" && (
        <div style={{
          padding: "1rem",
          background: "#dcfce7",
          border: "1px solid #16a34a",
          borderRadius: "8px",
          color: "#15803d",
        }}>
          <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>✅ {msg}</p>
          {results && results.length > 0 && (
            <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
              {results.map((r, i) => (
                <li key={i}>
                  <code>{r.column}</code>: {r.status}
                  {r.error && <span style={{ color: "#dc2626" }}> — {r.error}</span>}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "1rem" }}>
            <a href="/" style={{ color: "#15803d", fontWeight: "bold" }}>
              ← Volver a la app
            </a>
          </p>
        </div>
      )}

      {status === "needs-login" && (
        <div style={{
          padding: "1rem",
          background: "#fef3c7",
          border: "1px solid #d97706",
          borderRadius: "8px",
          color: "#92400e",
        }}>
          {msg}
          <p style={{ marginTop: "1rem" }}>
            <a href="/" style={{ color: "#92400e", fontWeight: "bold" }}>
              ← Iniciar sesión
            </a>
          </p>
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "1rem",
          background: "#fee2e2",
          border: "1px solid #dc2626",
          borderRadius: "8px",
          color: "#991b1b",
        }}>
          Error: {msg}
        </div>
      )}
    </div>
  );
}
