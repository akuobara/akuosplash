const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await r.json();
  const keys = (data.envs || []).map(e => e.key);
  console.log('Todas las variables:', keys.join(', '));
  console.log('\nAKUOSPLASH_JWT_SECRET:', keys.includes('AKUOSPLASH_JWT_SECRET') ? 'SÍ existe' : 'NO existe ← PROBLEMA');
  console.log('AKUOSPLASH_DATABASE_URL:', keys.includes('AKUOSPLASH_DATABASE_URL') ? 'SÍ existe' : 'NO existe (usa fallback DATABASE_URL)');
}
main().catch(e => { console.error(e); process.exit(1); });
