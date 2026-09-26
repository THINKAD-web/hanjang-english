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

## 디버그 날짜

`NEXT_PUBLIC_DEBUG=true` 일 때만 `?date=YYYY-MM-DD` 로 오늘 날짜를 바꿀 수 있다 (예: `/?date=2026-09-28`).
Preview 환경에서만 켜고 Production 에서는 설정하지 않는다. 잘못된 날짜는 무시된다.

## 배포

Vercel (Preview → Production). 환경 변수는 `.env.example` 참고.
