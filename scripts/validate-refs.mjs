import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const m = await import("@somakine/bodyparts3d-musculoskeletal");
const pack = m.bodyParts3DMusculoskeletal;
const ids = new Set(pack.structures.map((s) => s.id.replace("somakine:structure:", "")));
const regions = new Set(pack.regions.map((r) => r.id.replace("somakine:region:", "")));

const atlas = readFileSync(path.join(root, "src/anatomy/atlas.ts"), "utf8");
const bad = [];
for (const mm of atlas.matchAll(/bones:\s*\["([^"]+)",\s*"([^"]+)"\]/g)) {
  for (const b of [mm[1], mm[2]]) if (!ids.has(b)) bad.push(b);
}
console.log("atlas bad bones:", bad.length ? [...new Set(bad)] : "none");
console.log("pack regions:", [...regions].join(", "));

for (const mm of atlas.matchAll(/id:\s*"(head-neck|shoulder|elbow-forearm|wrist-hand|spine-trunk|hip-pelvis|knee|ankle-foot)"/g)) {
  if (!regions.has(mm[1])) console.log("bad region in atlas:", mm[1]);
}

const files = ["hand", "tmj", "shoulder", "arm", "lower"];
const poses = new Set(["standing", "supine", "prone", "left", "right", "sitting"]);
const jointIds = new Set([...atlas.matchAll(/id:\s*"([a-z-]+)",\n\s+label/g)].map((x) => x[1]));
for (const f of files) {
  const src = readFileSync(path.join(root, "src/content/tutorials", f + ".ts"), "utf8");
  for (const mm of src.matchAll(/regionId:\s*"([^"]+)"/g)) {
    if (!regions.has(mm[1])) console.log(`bad regionId in ${f}:`, mm[1]);
  }
  for (const mm of src.matchAll(/jointId:\s*"([^"]+)"/g)) {
    if (!jointIds.has(mm[1])) console.log(`bad jointId in ${f}:`, mm[1], "known:", [...jointIds].join("|"));
  }
  for (const mm of src.matchAll(/positions:\s*\[([^\]]+)\]/g)) {
    for (const p of mm[1].matchAll(/"([^"]+)"/g)) {
      if (!poses.has(p[1])) console.log(`bad pose in ${f}:`, p[1]);
    }
  }
}
console.log("done");
