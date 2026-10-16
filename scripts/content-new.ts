/**
 * npm run content:new -- <packId> --subject <subjectId> --title "<팩 이름>" [--level 초급] [--level-order 1] [--order N] [--tts ja-JP] [--dry-run]
 * content/packs/<packId>/ 에 pack.json(status: soon) + 빈 items.json 을 만든다. 이미 있으면 아무것도 하지 않는다.
 */
import path from "node:path";
import { contentRoot } from "@/lib/content/node";
import type { TtsLang } from "@/lib/content/schema";
import { parseArgs } from "@/lib/content/tools/plan";
import { planNewPack } from "@/lib/content/tools/scaffold";
import { finish } from "./content-tools";

const { positional, flags } = parseArgs(process.argv.slice(2), ["subject", "title", "level", "level-order", "order", "tts"]);
const [packId] = positional;
const str = (k: string) => (typeof flags.get(k) === "string" ? (flags.get(k) as string) : undefined);
const num = (k: string) => (str(k) === undefined ? undefined : Number(str(k)));

if (!packId || !str("subject") || !str("title")) {
  console.error('사용법: npm run content:new -- <packId> --subject <subjectId> --title "<팩 이름>" [--level 초급] [--level-order 1] [--order N] [--tts ja-JP] [--dry-run]');
  process.exit(1);
}
const root = contentRoot();
const plan = planNewPack(root, {
  packId,
  subjectId: str("subject")!,
  title: str("title")!,
  level: str("level"),
  levelOrder: num("level-order"),
  order: num("order"),
  ttsLang: str("tts") as TtsLang | undefined,
});
console.log(`content:new ${packId} (${path.relative(process.cwd(), root)}/)`);
finish(plan, root, flags.has("dry-run"));
