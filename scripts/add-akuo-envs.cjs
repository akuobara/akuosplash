const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function addEnv(key, value) {
  const r = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
  });
  const data = await r.json();
  console.log(`  ${key}: ${r.status === 200 ? '✓' : '✗'} ${data.error?.message || ''}`);
}

async function main() {
  console.log('Agregando variables faltantes:\n');
  await addEnv('AKUOSPLASH_JWT_SECRET', 'akuosplash-jwt-secret-prod-2026-cambiar');
  // AKUOSPLASH_DATABASE_URL no hace falta porque usa el fallback DATABASE_URL (misma Turso)
  console.log('\n✓ Listo. Hay que redeploy para que tome las variables.');
}
main().catch(e => { console.error(e); process.exit(1); });
