/**
 * npm run content:seed [-- --dry-run]
 * content/seed/seeds.json 의 시드 팩 5개를 content/packs/ 에 만든다. 여러 번 돌려도 같은 결과(멱등).
 */
import { contentRoot } from "@/lib/content/node";
import { parseArgs } from "@/lib/content/tools/plan";
import { planSeed } from "@/lib/content/tools/seed";
import { finish } from "./content-tools";

const { flags } = parseArgs(process.argv.slice(2), []);
const root = contentRoot();
console.log("content:seed");
finish(planSeed(root), root, flags.has("dry-run"));
