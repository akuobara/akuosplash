const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // 1) Crear A record
  console.log('=== Creando A record ===');
  const r1 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', type: 'A', value: '76.76.21.21', ttl: 300 }),
  });
  const d1 = await r1.json();
  console.log('Status:', r1.status, JSON.stringify(d1, null, 2));

  // 2) Crear CNAME para www
  console.log('\n=== Creando CNAME www ===');
  const r2 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'www', type: 'CNAME', value: 'cname.vercel-dns.com', ttl: 300 }),
  });
  const d2 = await r2.json();
  console.log('Status:', r2.status, JSON.stringify(d2, null, 2));

  // 3) Verificar
  console.log('\n=== DNS records finales ===');
  const r3 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d3 = await r3.json();
  console.log(JSON.stringify(d3, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
