import { meaningPrompt } from "@/lib/content/josa";
import type { RawContent } from "@/lib/content/load";

/**
 * 성인 영어(문장) 샘플 1장. 기획안 v2 5-5·8장 — picture_choice 를 낼 그림이 없는 팩에서
 * content:check 예외(picture_choice 0, fill_blank+listen_choice 3)가 정상 동작하는지,
 * 화면 컴포넌트가 그림 없는 아이템에서도 깨지지 않는지 확인하는 테스트 전용 fixture.
 * 실제 배포 목록(`content/packs.json`, `CONTENT_REGISTRY`)에는 넣지 않는다.
 */

const item = (id: string, text: string, meaningKo: string) => ({
  id,
  kind: "phrase" as const,
  text,
  meaningKo,
  imageable: false,
  tags: ["travel"],
});

const gate = item("adt-gate", "Where is the boarding gate?", "탑승구가 어디예요?");
const taxi = item("adt-taxi", "To the airport, please.", "공항으로 가주세요.");
const checkin = item("adt-checkin", "I have a reservation under Kim.", "김으로 예약했어요.");
const start = item("adt-start", "Let's get started.", "시작할까요.");
const hold = item("adt-hold", "Could you hold on a second?", "잠깐만 기다려 주시겠어요?");
const email = item("adt-email", "Please find the attached file.", "첨부 파일을 확인해 주세요.");
const check = item("adt-check", "Check, please.", "계산서 주세요.");
const bye = item("adt-bye", "It was nice meeting you.", "만나서 반가웠어요.");

export const adultSample: RawContent = {
  pack: {
    id: "en-adult-travel",
    language: "en",
    audience: "adult",
    title: "성인 영어 · 출장",
    brandLabel: "한장영어",
    unitKey: "travel",
    unitLabel: "travel",
    lessonCount: 1,
    status: "soon",
  },
  items: [gate, taxi, checkin, start, hold, email, check, bye],
  lessons: [
    {
      id: "en-adult-travel-01",
      packId: "en-adult-travel",
      dayNo: 1,
      title: "공항 · 회의 시작",
      focus: { label: "출장 첫날", lines: ["공항에서 쓰는 말과", "회의를 여는 말을 배워요."] },
      itemIds: [gate.id, taxi.id, checkin.id, start.id, hold.id, email.id, check.id, bye.id],
      sentences: [
        {
          text: "Where is the boarding gate? To the airport, please.",
          meaningKo: "탑승구가 어디예요? 공항으로 가주세요.",
          itemIds: [gate.id, taxi.id],
        },
        {
          text: "Let's get started. Could you hold on a second?",
          meaningKo: "시작할까요. 잠깐만 기다려 주시겠어요?",
          itemIds: [start.id, hold.id],
        },
      ],
      quiz: [
        {
          type: "meaning_choice",
          targetItemId: hold.id,
          prompt: meaningPrompt(hold.meaningKo),
          options: [hold.text, start.text, checkin.text],
          answer: hold.text,
        },
        { type: "ox", targetItemId: bye.id, statement: `${bye.text} = ${bye.meaningKo}`, answer: true },
        {
          type: "fill_blank",
          targetItemId: check.id,
          sentence: "At the restaurant: ____",
          options: [check.text, email.text, gate.text],
          answer: check.text,
        },
        { type: "listen_choice", targetItemId: taxi.id, options: [taxi.text, gate.text, checkin.text], answer: taxi.text },
        { type: "listen_choice", targetItemId: email.id, options: [email.text, checkin.text, start.text], answer: email.text },
      ],
      reviewed: false,
    },
  ],
};
