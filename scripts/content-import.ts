/**
 * npm run content:import -- <bundle.json> [--force] [--force-reviewed] [--dry-run]
 * { pack, items?, lessons[] } 번들을 content/packs/<id>/ 로 푼다. 이미 있는 packId 는 --force 없이는 거부.
 */
import { readFileSync } from "node:fs";
import { contentRoot } from "@/lib/content/node";
import { planImport } from "@/lib/content/tools/import-bundle";
import { parseArgs } from "@/lib/content/tools/plan";
import { finish } from "./content-tools";

const { positional, flags } = parseArgs(process.argv.slice(2), []);
const [file] = positional;
if (!file) {
  console.error("사용법: npm run content:import -- <bundle.json> [--force] [--force-reviewed] [--dry-run]");
  process.exit(1);
}
let bundle: unknown;
try {
  bundle = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`${file}: JSON 을 읽을 수 없다 (${e instanceof Error ? e.message : String(e)})`);
  process.exit(1);
}
const root = contentRoot();
console.log(`content:import ← ${file}`);
finish(planImport(root, bundle, { force: flags.has("force"), forceReviewed: flags.has("force-reviewed") }), root, flags.has("dry-run"));
