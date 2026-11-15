const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  const r = await c.execute({ sql: "SELECT mpSubAccessToken FROM AkuoConfig LIMIT 1" });
  const token = String(r.rows[0]?.mpSubAccessToken || "");
  const derivedEmail = "test_user_2094743021490827193@testuser.com";
  const body = {
    reason: "TEST verify email",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 950, currency_id: "CLP" },
    payer_email: derivedEmail,
    back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    status: "pending",
    external_reference: "akuo_test_email:verify",
  };
  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("HTTP:", res.status);
  if (res.ok) {
    console.log("✅ MP ACEPTÓ el email derivado + monto válido");
    console.log("preapproval_id:", data.id);
    console.log("init_point:", data.init_point ? "SÍ" : "NO");
    console.log("sandbox_init_point:", data.sandbox_init_point ? "SÍ" : "NO");
    // cancelar
    await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    console.log("(cancelada)");
  } else {
    console.log("❌ error:", JSON.stringify(data).slice(0, 400));
  }
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
