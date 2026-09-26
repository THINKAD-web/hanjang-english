# 한장영어

초등 3~4학년이 하루 8분, 한글 자음(ㄱ) 테마로 영어 한 장을 끝내고, 부모는 오답만 보는 앱 (MVP).

- MVP 에는 서버·DB·로그인이 없다. 모든 기록은 기기의 localStorage 에만 저장되고 아동 데이터는 서버로 나가지 않는다.
- 날짜 판단은 전부 **Asia/Seoul 기준 `YYYY-MM-DD`** 키 (`lib/engine/date.ts`).

## 개발

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck    # next typegen && tsc --noEmit
npm test             # Vitest (엔진 단위 테스트)
npm run build
```

Node 22 이상 (`.nvmrc`).

## 콘텐츠

- `content/giyeok/` — `pack.json`, `words.json`(단어 뱅크 52개), `lessons/01~08.json`
- 스키마: `lib/content/schema.ts` (zod), 규칙: `lib/content/check.ts`
- `npm run content:check` — 규칙 검사 후 검수표 `docs/content-review.md` 생성. CI 에서도 실행하며 검수표가 최신이 아니면 실패한다
- 검수가 끝난 장은 레슨 JSON 의 `reviewed` 를 `true` 로 바꾸고 `content:check` 를 다시 돌려 검수표를 커밋한다
- 레슨 파일을 추가하면 `lib/content/load.ts` 에도 import 한다 (누락 시 content:check 가 잡는다)

## 디버그 날짜

`NEXT_PUBLIC_DEBUG=true` 일 때만 `?date=YYYY-MM-DD` 로 오늘 날짜를 바꿀 수 있다 (예: `/?date=2026-09-28`).
Preview 환경에서만 켜고 Production 에서는 설정하지 않는다. 잘못된 날짜는 무시된다.

디버그 모드에서는 홈 아래에 디버그 패널이 보인다: `◀ 전날` / `다음 날 ▶` / `실제 오늘` / `기록 초기화`.
날짜를 바꿔도 기록은 같은 기기(localStorage)에 쌓이므로, 처음부터 다시 볼 때는 `기록 초기화`.

L1 → L2 확인 예시:
1. `/?date=2026-09-28` (월) → 오늘 한 장 시작 → L1 끝까지
2. 홈에서 `다음 날 ▶` (2026-09-29, 화) → 버튼 아래 "2장 · g 소리 기초"
3. 주말 날짜는 복습장(PR4) 차례라 버튼이 잠긴다. 평일 날짜로 확인할 것
4. 한 장에서 3문제 이상 틀리면 다음 평일은 복습장(PR4) 차례가 된다

## 배포

Vercel (Preview → Production). 환경 변수는 `.env.example` 참고.
