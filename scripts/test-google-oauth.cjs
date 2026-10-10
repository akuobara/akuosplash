const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // Verificar que las variables de entorno estén configuradas
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await r.json();
  for (const e of (data.envs || [])) {
    if (e.key.includes('GOOGLE') || e.key.includes('FACEBOOK') || e.key.includes('AKUO')) {
      console.log(`${e.key}: type=${e.type} target=${JSON.stringify(e.target)} (valor oculto por seguridad)`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
