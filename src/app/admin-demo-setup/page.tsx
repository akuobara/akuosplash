"use client";
import { useEffect, useState } from "react";

export default function AdminDemoSetupPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "needs-login">("loading");
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/demo/setup", {
          method: "POST",
          credentials: "include",
        });
        const d = await res.json();
        if (res.ok) {
          setStatus("ok");
          setData(d);
          setMsg("Cuenta demo creada/actualizada.");
        } else if (res.status === 401) {
          setStatus("needs-login");
          setMsg("Necesitás iniciar sesión como super-admin primero.");
        } else if (res.status === 403) {
          setStatus("needs-login");
          setMsg("Solo el super-admin puede generar la cuenta demo.");
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
      <h1>Generar cuenta de demostración</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Crea (o regenera) la cuenta demo con datos ficticios realistas.
        La cuenta es read-only: puede navegar y ver todo, pero no puede editar.
      </p>

      {status === "loading" && <p>Generando datos ficticios (puede tardar 30-60 segundos)…</p>}

      {status === "ok" && (
        <div style={{ padding: "1rem", background: "#dcfce7", border: "1px solid #16a34a", borderRadius: "8px", color: "#15803d" }}>
          <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>✅ {msg}</p>
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fff", borderRadius: "6px", border: "1px solid #d1d5db" }}>
            <p style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "#1f2937" }}>Credenciales admin/chofer:</p>
            <p style={{ color: "#1f2937" }}><strong>Email:</strong> {data?.adminEmail || "demo@aljibe.app"}</p>
            <p style={{ color: "#1f2937" }}><strong>Contraseña:</strong> {data?.adminPassword || "demo1234"}</p>
          </div>
          <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#fff", borderRadius: "6px", border: "1px solid #d1d5db" }}>
            <p style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "#1f2937" }}>Credenciales cliente (app /cliente):</p>
            <p style={{ color: "#1f2937" }}><strong>Email:</strong> {data?.clienteAppEmail || "cliente@demo.aljibe.app"}</p>
            <p style={{ color: "#1f2937" }}><strong>Contraseña:</strong> {data?.clienteAppPassword || "demo1234"}</p>
          </div>
          {data && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
              <p style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>Datos generados:</p>
              <ul style={{ paddingLeft: "1.5rem", marginTop: "0.25rem", color: "#15803d" }}>
                <li>{data.choferes} choferes</li>
                <li>{data.camiones} camión</li>
                <li>{data.clientes} clientes</li>
                <li>{data.vueltas} vueltas</li>
                <li>{data.entregas} entregas</li>
                <li>{data.gastos} gastos</li>
                <li>{data.pagos} pagos</li>
              </ul>
            </div>
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
