const { createClient } = require('@libsql/client');
const client = createClient({ 
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const usuarios = await client.execute("SELECT id, email, nombre, role, duenoId FROM Usuario");
  console.log('Usuarios:');
  for (const u of usuarios.rows) {
    console.log(`  ${u.email} | ${u.nombre} | role=${u.role} | duenoId=${u.duenoId}`);
  }
  
  const pedidos = await client.execute("SELECT id, clienteNombre, estado, duenoId FROM Pedido WHERE estado='entregado'");
  console.log('\nPedidos entregados:');
  for (const p of pedidos.rows) {
    console.log(`  ${p.clienteNombre} | estado=${p.estado} | duenoId=${p.duenoId}`);
  }
}
main().catch(e => console.error(e));
