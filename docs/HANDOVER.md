# 오늘 한장 — 인수인계 자료

작성 기준: PR #9(`claude/platform-bulk-content`, C0–C10 + 후속 수정) 시점. 제품 기획의 원본은 `docs/오늘한장_기획안_v2.md`, 콘텐츠 추가 방법은 `docs/CONTENT_GUIDE.md`, 코드 작업 시 주의사항은 `AGENTS.md` 를 본다.

---

## 1. 플랫폼 개요

**한 줄:** 하루에 한 장을 끝내는 습관 앱. **코어는 하나, 언어·나이·과목은 "팩"으로 늘린다.**

- 앱 이름 "오늘 한장", 첫 팩 "한장영어"(어린이 영어 · 한글 자음 ㄱ 8장). 이름 문자열은 `lib/brand.ts` 한 곳에만 있다(상표 확인 전 가칭).
- 어린이 / 성인은 별도 앱이 아니라 라이브러리(팩 슬롯). 쓰는 프로필 종류(아이/나)에 따라 보이는 과목과 색(스킨)만 달라진다.
- 하루 루프: 오늘의 장 → (소리/카드/전체 듣기/예문 또는 연습/패턴) → 퀴즈 5 → 채점 → 오답 저장 → 도장 → 부모 요약.
- 저장은 **기기 localStorage 만**(계정·서버 DB·결제 없음). 지표는 `/parent` → 기록 내보내기 JSON 으로 본다.
- 스택: Next.js 16(App Router, 이 버전은 기존 지식과 다를 수 있으니 `node_modules/next/dist/docs/` 확인) · React 19 · TypeScript strict · Tailwind · zod 4 · Vitest. 배포 Vercel.

### 화면(라우트)
| 경로 | 역할 |
|---|---|
| `/` | 홈: 이어서 카드, 이번 주 도장, 내 팩(진행 중 최대 3 + 전체 보기) |
| `/packs`, `/packs/[packId]` | 대상 탭 → 과목 → 레벨 → 팩 카드(진행·잠금·준비 중) / 팩 목차 |
| `/learn/[packId]` | 오늘 할 일은 **엔진이 결정**(URL 로 장을 건너뛸 수 없음) |
| `/learn/[packId]/[lessonId]` | 끝낸 장 다시 보기(기록 안 남김) |
| `/parent`, `/account` | 부모 PIN 뒤. 오늘/주간 요약·오답 토글 / 학년·프로필·PIN·내보내기·초기화 |

### 핵심 규칙(엔진, `lib/engine/`)
- 장은 완료한 순서대로 진행. **팩별** 하루 2장 한도(2장째는 직전 평일을 쉬었을 때만). 평일 활성 오답 ≥3 이면 복습장, 주말은 복습장 우선. 오답 <3 이면 다음 장 5번 문항에 오답 1개 삽입.
- 진도·도장은 저장하지 않고 매번 Attempt 에서 계산. 도장은 전 팩 합산.
- 오답 큐·복습·완료 장은 (프로필, 팩) 단위로 완전히 독립.

---

## 2. 지금까지 작업된 내용

### 이전(PR0~PR5, main 머지 완료)
PR0 뼈대 → PR1 ㄱ 8장 콘텐츠·스키마 → PR2 엔진 → PR3/3a 아이 화면·플랫폼 뼈대 → PR4 복습·잠금 화면 → PR5 부모 화면.

### 이번 PR #9 (C0–C10, 목표: 새 팩을 **데이터 파일만**으로 추가)
| 커밋 | 내용 |
|---|---|
| C0 | `en-kid-giyeok` 골든 스냅샷(정규화 결과·판단·보기 순서). 이후 모든 변경이 이것과 같아야 한다 |
| C1 | 브랜드 문자열 `lib/brand.ts` |
| C2 | zod 스키마(`lib/content/schema.ts`), `pack.rules`(하드코딩 숫자 제거), `content/packs/<id>/` 폴더, `focus→intro`, `dayNo→order`, `content/subjects.json` |
| C3 | `content:build` → `public/content/manifest.json` + 팩 번들(gitignore, prebuild/predev 자동). 화면은 `ContentRepository`(fetch)만 사용 |
| C4 | 상태 v2(`stateVersion: 2`, `activeProfileId`, `activePackId`, Attempt.subjectId), **옛 기록 무손실 마이그레이션**(+원본 백업), Track 자동 생성 |
| C5 | 스텝 레지스트리(`intro cards listen sentences practice patterns quiz`), 레슨 타입별 기본 스텝, `pack.ttsLang`, 시작 게이트 |
| C6 | 수학 생성기(`+ - × ÷`, noCarry/noBorrow), autoQuiz, 수학 보기 규칙, 정답 재계산 검증 |
| C7 | `content:new/csv/import/report`, `content:check` 팩별 요약 |
| C8 | `content:seed` + 시드 5팩(수학 덧셈·뺄셈, 영어 동물, 성인 영어 출장, 일본어 히라가나). 전부 testOnly·검수 전 |
| C9 | `/packs` 개편, 프로필 추가·전환, `data-audience` 스킨, 부모 팩 선택 |
| C10 | "검수 전" 배지, 빈 콘텐츠 방어(`packUnavailable`), 문서 |
| 후속 | Debug 에서 레슨 있는 준비 중 팩(성인 영어 출장)을 홈·부모 화면에서도 열기(`isOpenPack`) |

검증: vitest 350건, lint/typecheck/content:check/build, GitHub Actions `check` 통과. 골든 JSON·`docs/content-review.md` 는 변경 0.

### 코드 지도
```
content/                  ← 사람이 편집하는 원본(subjects.json, packs/<id>/{pack.json,items.json,lessons/}, seed/)
lib/content/              schema · normalize(원본→앱용) · check(규칙) · visibility(공개 게이트) · repository · generator · auto-quiz · tools/(CLI 로직)
lib/engine/               decideToday · queue(오답) · progress(기록) · quizgen · sheet(한 장 상태머신)
lib/store/                types(State) · local(localStorage) · migrate
lib/packs/                catalog(과목/레벨/진행/잠금) · availability
components/learn|packs|parent/   화면
scripts/content-*.ts      CLI
```

### 공개 게이트(중요)
Production 에서 보이는 레슨 = 팩 `status: live` **그리고** `reviewed: true` **그리고** `testOnly` 아님. 일부만 검수되면 앞에서부터 연속된 검수 레슨까지만. 판단은 `lib/content/visibility.ts` **한 곳**. Production 빌드는 비공개 팩을 `public/content` 파일로도 내보내지 않는다. `NEXT_PUBLIC_DEBUG=true`(Preview)는 전부 열리고 "검수 전" 배지. **`NEXT_PUBLIC_DEBUG` 는 빌드 시점 값**이라 바꾸면 재배포가 필요하다.

---

## 3. 운영 메모(함정)

- 로컬 `next build` 는 기준선 타입 에러 때문에 실패할 수 있다(AGENTS.md). Vercel 조건은 `VERCEL=1 SKIP_CATALOG_HEAVY_SSG=1 npx next build --webpack`. 신규 타입 에러는 `npx tsc --noEmit` 건수로 판정.
- 빌드 후 `public/sw.js` 가 바뀌면 커밋하지 말고 되돌린다.
- 기존 `packId`(`en-kid-giyeok`)와 localStorage 키(`hanjang-state-v2`)는 바꾸지 않는다. 저장 기록이 가리킨다.
- 콘텐츠를 지어내서 채우지 않는다(짧은 마지막 레슨은 경고+규칙 위반으로 막힌다). 시드 문장은 테스트용이며 **검수 전**이다.
- 중첩 서버 정리: 샌드박스에서 `next start` 를 띄웠다면 종료할 것(포트 충돌로 낡은 빌드가 응답함).

---

## 4. 아직 확인/완료되지 않은 것

1. **iOS Safari 실기기**: 음성 자동 재생(특히 일본어 `ja-JP`), 숫자 키패드. 샌드박스는 Chromium 만, 음성은 모의.
2. Preview 에서 성인 프로필로 영어 출장 1장 끝까지(Debug 빌드 필요).
3. 수학 오답 → 다음 날 복습은 단위 테스트로만 확인(브라우저 날짜 이동 미실시).
4. 상표 검색("오늘 한장" vs 미래엔 "하루한장") 미완.
5. grass 실사 이미지 등 `docs/image-todo.md`.
6. 시드 5팩은 전부 검수 전 — 공개하려면 사람 검수(아래 5-A).
7. 가족 테스트(4주)는 아직 시작 전.

---

## 5. 앞으로의 진행 제안

### A. 먼저(공개 가능한 상태로 만들기) — 1~2주
1. PR #9 머지 → Preview 에서 위 4-1~3 수동 확인.
2. **검수 파이프라인 가동**: `npm run content:report -- <packId>` 로 표를 뽑아 검수 → 통과한 레슨만 `reviewed: true`, `testOnly` 제거. 수학 팩은 생성 문제라 콘텐츠 검수 부담이 작아 **가장 먼저 공개하기 좋다**(덧셈 1부터 앞 구간만 열어도 됨).
3. 가족 테스트 시작 조건 충족: `/parent` + 기록 내보내기가 이미 있음. KPI(기획안 17장): 완료율 70%, 3일 연속 50%, 한 장 6~10분, 부모 요약 주 3회.

### B. 가족 테스트 4주 동안
- 새 기능을 넣지 말고 지표만 본다(`sheet_abort.step` 으로 이탈 단계, `step_time`, `pack_interest`, `next_pack_request`).
- 이때 결과로 **2호 팩 순서**를 정한다: 성인 영어 출장 → 일본어 여행 → 중국어(성조 필드·TTS 확인 필요, 마지막).

### C. 그 다음(우선순위 순)
1. **콘텐츠 확장**: ㄴ~ㅎ 자음 장(ㄱ 끝나기 전에는 만들지 않는다는 원칙), 2회차 트랙(ㅁ 이후 설계). 이미 CSV/번들/생성기 도구가 있어 "데이터만" 넣으면 된다.
2. **결제·계정**(`next_pack_request` 가 실제로 나온 뒤): Prisma 도입, 슬롯(프로필×팩) 기준 구독, `access: paid` 표시를 실제 잠금으로 연결. 무료 범위는 "첫 단위 전체". 지금 State 는 서버 모델(Account/Profile/Track/Attempt/WrongQueue/Event)과 같은 모양이라 키 이름만 옮기면 된다. **이전 시 마이그레이션 원칙(옛 기록 무손실·백업)을 유지**할 것.
3. **오디오/이미지 품질**: mp3 업로드 경로(`item.audio`)는 이미 지원. 어린이 영어는 사람 녹음 또는 고품질 TTS 로 교체 검토.
4. **성인 UX 분화**: 지금 성인 스킨은 색만 다르다. 문장 팩은 패턴(`patterns`)·듣기(`listening`) 타입을 실제 콘텐츠로 쓰며 필요한 화면(문장 단위 학습, 받아쓰기)을 추가.
5. **부모/본인 요약 확장**: 약점 태그 집계는 `tagLabel` 로 팩마다 이름이 이미 바뀜 → 주간 PDF/공유 카드(PR6 후보)는 그 위에서.
6. 기술 부채: 마이그레이션 백업 키 정리 정책, `useProgress` 구독 구조 점검(다중 탭), 접근성(Lighthouse) 점검, E2E(Playwright) 정식 도입 — 지금은 수동 스크립트로만 확인.

### D. 하지 않을 것(기획안 유지)
배너 광고, 코인/가챠, AI 실시간 출제를 메인으로 내세우기, 언어별 결제 상품 쪼개기, 외부 유료 API 호출.

---

## 6. 새 작업자가 첫날 할 일
1. `git clone` 후 `npm ci` → `npm run lint && npm run typecheck && npm test && npm run content:check && npm run build` 가 모두 통과하는지 확인.
2. `NEXT_PUBLIC_DEBUG=true npm run dev` 로 `/packs` 에서 시드 팩을 눌러 보기(홈 하단 디버그 패널로 날짜 이동·N장 완료 처리).
3. `docs/CONTENT_GUIDE.md` 대로 CSV 8단어짜리 팩 하나를 `--dry-run` 으로 만들어 보기.
4. 변경 전 `lib/content/golden.test.ts` 가 통과하는지 — 이 테스트가 깨지면 `en-kid-giyeok` 경험이 바뀐 것이다.
