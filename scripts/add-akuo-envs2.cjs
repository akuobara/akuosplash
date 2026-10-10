const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  const r = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'AKUOSPLASH_JWT_SECRET', value: 'akuosplash-jwt-secret-prod-2026-cambiar', type: 'encrypted', target: ['production', 'preview', 'development'] }),
  });
  const text = await r.text();
  console.log('Status:', r.status);
  console.log('Response:', text);
}
main().catch(e => { console.error(e); process.exit(1); });
