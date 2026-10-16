/**
 * npm run content:csv -- <packId> <file.csv> [--size 8] [--type vocab] [--kind word] [--test-only] [--force-reviewed] [--dry-run]
 * CSV(헤더: text,meaningKo,emoji,tags,imageable,reading)를 --size 개씩 끊어 content/packs/<packId>/lessons/NN.json 으로 쓴다.
 */
import { readFileSync } from "node:fs";
import { contentRoot } from "@/lib/content/node";
import type { Item, LessonType } from "@/lib/content/schema";
import { planCsv } from "@/lib/content/tools/csv";
import { parseArgs } from "@/lib/content/tools/plan";
import { finish } from "./content-tools";

const { positional, flags } = parseArgs(process.argv.slice(2), ["size", "type", "kind"]);
const [packId, file] = positional;
const str = (k: string, d: string) => (typeof flags.get(k) === "string" ? (flags.get(k) as string) : d);
if (!packId || !file) {
  console.error("사용법: npm run content:csv -- <packId> <file.csv> [--size 8] [--type vocab] [--kind word] [--test-only] [--force-reviewed] [--dry-run]");
  process.exit(1);
}
const root = contentRoot();
const plan = planCsv(root, readFileSync(file, "utf8"), {
  packId,
  size: Number(str("size", "8")),
  lessonType: str("type", "vocab") as LessonType,
  kind: str("kind", "word") as Item["kind"],
  testOnly: flags.has("test-only"),
  forceReviewed: flags.has("force-reviewed"),
});
console.log(`content:csv ${packId} ← ${file}`);
finish(plan, root, flags.has("dry-run"));
