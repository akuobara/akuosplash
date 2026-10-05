const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  let allEnvs = [];
  let cursor = null;
  do {
    const url = `https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const data = await r.json();
    allEnvs = allEnvs.concat(data.envs || []);
    cursor = data.pagination?.next;
  } while (cursor);

  for (const e of allEnvs) {
    if (e.key.includes('FACEBOOK') || e.key.includes('AKUO')) {
      console.log(`${e.key} | id=${e.id} | type=${e.type}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
