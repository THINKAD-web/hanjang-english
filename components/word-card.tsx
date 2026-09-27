import type { Item } from "@/lib/content/schema";

/** 그림(이미지 우선, 없으면 이모지). 그림이 없는 단어는 빈 자리 없이 글자만. */
export function WordPicture({ word, size = "lg" }: { word: Item; size?: "lg" | "sm" }) {
  const box = size === "lg" ? "h-32 w-32 text-8xl" : "h-14 w-14 text-5xl";
  if (word.image) {
    // eslint-disable-next-line @next/next/no-img-element -- 정적 콘텐츠 이미지, 최적화 불필요
    return <img src={word.image} alt={word.meaningKo} className={`${box} object-contain`} />;
  }
  if (!word.emoji) return null;
  return (
    <span role="img" aria-label={word.meaningKo} className={`flex ${box} items-center justify-center leading-none`}>
      {word.emoji}
    </span>
  );
}

/** 단어 카드: 그림 · 철자(32px 이상) · 뜻 */
export function WordCard({ word, size = "lg" }: { word: Item; size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div
      className={`flex w-full flex-col items-center rounded-3xl bg-white shadow-sm ring-1 ring-amber-200 ${
        lg ? "gap-3 px-6 py-8" : "flex-row gap-4 px-4 py-3"
      }`}
    >
      <WordPicture word={word} size={size} />
      <div className={lg ? "text-center" : ""}>
        <p lang="en" className={`font-bold tracking-tight text-slate-900 ${lg ? "text-5xl" : "text-3xl"}`}>
          {word.text}
        </p>
        <p className={`text-slate-600 ${lg ? "mt-2 text-2xl" : "text-xl"}`}>{word.meaningKo}</p>
      </div>
    </div>
  );
}
