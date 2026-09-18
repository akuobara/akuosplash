"use client";
import { useEffect, useState } from "react";

export default function AdminActivarPedidosChoferesPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "needs-login">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/activar-choferes-pedidos", {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setStatus("ok");
          setMsg("✅ choferesPuedenCrearPedidos activado. Los choferes ya pueden agendar pedidos.");
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
      textAlign: "center",
    }}>
      <h1>Activar permiso de choferes para crear pedidos</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Esta página activa el flag <code>choferesPuedenCrearPedidos=true</code> en la configuración
        del administrador actual.
      </p>
      {status === "loading" && <p>Procesando…</p>}
      {status === "ok" && (
        <div style={{
          padding: "1rem",
          background: "#dcfce7",
          border: "1px solid #16a34a",
          borderRadius: "8px",
          color: "#15803d",
        }}>
          {msg}
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
