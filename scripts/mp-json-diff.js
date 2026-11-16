const fs = require("fs");
const A = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/mp-prep-authorized.json","utf8"));
const P = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/mp-prep-pending.json","utf8"));

function flat(o, pre="") {
  const out = {};
  if (o == null || typeof o !== "object") { out[pre||"."] = o; return out; }
  if (Array.isArray(o)) { out[pre] = JSON.stringify(o); return out; }
  for (const k of Object.keys(o)) Object.assign(out, flat(o[k], pre ? `${pre}.${k}` : k));
  return out;
}
const fa = flat(A), fp = flat(P);
const keys = new Set([...Object.keys(fa), ...Object.keys(fp)]);
console.log("Campo | AUTHORIZED | PENDING | diff");
for (const k of [...keys].sort()) {
  const va = JSON.stringify(fa[k]);
  const vp = JSON.stringify(fp[k]);
  if (va !== vp) console.log(`${k} | ${va} | ${vp} | ⚠️`);
}
console.log("\n--- campos exclusivos AUTHORIZED ---");
for (const k of Object.keys(fa)) if (!(k in fp)) console.log(`  ${k} = ${JSON.stringify(fa[k])}`);
console.log("--- campos exclusivos PENDING ---");
for (const k of Object.keys(fp)) if (!(k in fa)) console.log(`  ${k} = ${JSON.stringify(fp[k])}`);
