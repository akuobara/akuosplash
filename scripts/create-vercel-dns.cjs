const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // 1) Crear A record para akuosplash.cl → Vercel IP
  console.log('=== Creando A record (akuosplash.cl → 76.76.21.21) ===');
  const r1 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      type: 'A',
      value: '76.76.21.21',
      ttl: 300,
    }),
  });
  const d1 = await r1.json();
  console.log('Status:', r1.status);
  console.log(JSON.stringify(d1, null, 2));

  // 2) Crear CNAME para www → cname.vercel-dns.com
  console.log('\n=== Creando CNAME (www → cname.vercel-dns.com) ===');
  const r2 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'www',
      type: 'CNAME',
      value: 'cname.vercel-dns.com',
      ttl: 300,
    }),
  });
  const d2 = await r2.json();
  console.log('Status:', r2.status);
  console.log(JSON.stringify(d2, null, 2));

  // 3) Verificar nameservers asignados por Vercel
  console.log('\n=== Verificando nameservers ===');
  const r3 = await fetch(`https://api.vercel.com/v6/domains/akuosplash.cl?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d3 = await r3.json();
  console.log('nameservers:', d3.domain?.nameservers);
  console.log('intendedNameservers:', d3.domain?.intendedNameservers);
  console.log('zone:', d3.domain?.zone);

  // 4) Listar DNS records finales
  console.log('\n=== DNS records finales ===');
  const r4 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d4 = await r4.json();
  console.log(JSON.stringify(d4, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
