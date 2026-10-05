import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const mod = await import("@somakine/bodyparts3d-musculoskeletal");
const pack = mod.bodyParts3DMusculoskeletal ?? mod.default;
const known = new Set(pack.structures.map((s) => String(s.id).replace(/^somakine:structure:/, "")));

const files = ["hand", "tmj", "shoulder", "arm", "lower"];
const problems = [];
let checked = 0;

for (const f of files) {
  const src = readFileSync(path.join(root, "src/content/tutorials", f + ".ts"), "utf8");
  const patterns = [
    /siteBones:\s*\[([^\]]*)\]/g,
    /structure:\s*"([^"]+)"/g,
    /mobileBone:\s*"([^"]+)"/g,
  ];
  const found = [];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(src))) {
    for (const id of m[1].matchAll(/"([^"]+)"/g)) found.push([id[1], m.index]);
    if (!m[1].includes('"')) found.push([m[1], m.index]);
    }
  }
  for (const [id] of found) {
    checked++;
    if (!known.has(id)) problems.push(`${f}: ${id}`);
  }
}

console.log(`checked ${checked} bone references across ${files.length} files`);
if (problems.length) {
  console.log("MISSING:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
} else {
  console.log("all bone ids resolve");
}
