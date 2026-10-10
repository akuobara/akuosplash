const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';
const ENV_ID = 'VPyObAIWTIJptJRd';

async function main() {
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${ENV_ID}?teamId=${TEAM_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: 'akuosplash-jwt-secret-prod-2026-secure-random-x9k2m',
      target: ['production', 'preview', 'development']
    }),
  });
  const data = await r.json();
  console.log('Status:', r.status);
  console.log('Updated:', data.key || data);
}
main().catch(e => { console.error(e); process.exit(1); });
