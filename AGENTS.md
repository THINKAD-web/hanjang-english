<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 한장영어 규칙

- 규칙(오늘 할 일 판단, 오답 큐, 퀴즈 생성)은 `lib/engine/` 의 **순수 함수 + Vitest** 로 먼저 만든다. UI 는 엔진을 호출만 한다.
- 날짜는 `lib/engine/date.ts` 의 Asia/Seoul 날짜 키만 쓴다. `new Date()` 를 직접 비교하지 않는다.
- 저장은 `ProgressStore` 인터페이스 뒤에서만 한다 (MVP 는 localStorage). 서버로 아동 데이터를 보내지 않는다.
- 콘텐츠 중 `reviewed: false` 항목은 사람 검수 전까지 머지하지 않는다.
- 지시서에 없는 기능(로그인, 결제, 푸시, AI 출제, 광고, 코인·가챠, 서버 DB)은 추가하지 않는다.
- main 직접 푸시 금지. PR 단위로 작업한다.
