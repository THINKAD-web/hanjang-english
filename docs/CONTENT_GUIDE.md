# 새 팩 추가하는 법 (한 장)

새 과목·레벨·팩은 **데이터 파일만** 넣으면 앱에 나타난다. `.ts` / `.tsx` 는 한 줄도 고치지 않는다.

```
content/
  subjects.json                  과목 목록 (id, name, audience: kid|adult, icon, order)
  packs/<packId>/
    pack.json                    팩 정보 + rules (아래 2)
    items.json                   (선택) 팩 공용 아이템 뱅크
    lessons/01.json, 02.json …   레슨. 아이템은 레슨 안에 직접 적어도 된다 (items)
  seed/                          시드(테스트용) 원본 — `npm run content:seed` 가 packs/ 로 만든다
```

폴더에 `pack.json` 이 있으면 **자동 등록**된다 (목록 파일이 따로 없다). `packId` 는 소문자·숫자·하이픈이고, 한 번 정하면 바꾸지 않는다 (저장된 진행 기록이 이 id 를 가리킨다).

> npm 스크립트에 옵션을 넘길 때는 `--` 뒤에 쓴다: `npm run content:csv -- <packId> words.csv --size 8`.
> 모든 도구는 `--dry-run` 을 지원한다 (무엇이 바뀔지만 보여 주고 아무것도 쓰지 않는다). 같은 입력으로 다시 돌리면 아무것도 바뀌지 않는다.

## 1. 가장 빠른 길 — CSV 로 단어 팩 만들기

```bash
npm run content:new  -- en-kid-animals --subject en-kid --title "어린이 영어 · 동물"
npm run content:csv  -- en-kid-animals animals.csv --size 8 --test-only
npm run content:check            # 규칙 검사 + 팩별 요약표
npm run content:report -- en-kid-animals   # docs/content-review/en-kid-animals.md (눈으로 검수)
```

CSV 첫 줄(헤더)은 `text,meaningKo,emoji,tags,imageable,reading` — `text` 만 필수다.

| 열 | 뜻 |
|---|---|
| text | 단어/문장/가나 |
| meaningKo | 한국어 뜻 (단어·문장은 필수) |
| emoji | 그림 대신 쓰는 이모지 |
| tags | `\|` 또는 `;` 로 구분. 부모 요약의 "자주 헷갈리는 …" 집계에 쓰인다 |
| imageable | `true/false`. 비우면 emoji 가 있으면 true. 그림 문제를 낼 수 있는 아이템인가 |
| reading | 로마자·발음. **가나는 필수** |
| kind | (선택) `word/phrase/kana/hanzi` — 한 CSV 에 글자와 낱말을 섞을 때. 비우면 `--kind` 값 |

- `--size` 개씩 끊어 레슨이 된다 (100단어, size 8 → 13레슨). **마지막 레슨이 모자라면 경고**를 내고, `content:check` 가 규칙 위반으로 막는다. 지어내서 채우지 않는다 — CSV 에 단어를 더하거나 뺀다.
- 퀴즈는 `autoQuiz` 가 만든다 (보기는 같은 종류 아이템에서, `imageable: false` 아이템에는 그림 문제가 없다).
- 이미 `reviewed: true` 인 레슨은 `--force-reviewed` 없이는 덮어쓰지 않는다.

## 2. pack.json 과 rules

```json
{
  "id": "en-kid-animals",
  "subjectId": "en-kid",
  "title": "어린이 영어 · 동물",
  "level": "초급", "levelOrder": 1, "order": 2,
  "unitLabel": "동물",
  "tagLabel": "분류",
  "ttsLang": "en-US",
  "status": "live",
  "access": "free",
  "unlock": { "afterPackId": "en-kid-giyeok" },
  "rules": {
    "itemsPerLesson": 8, "sentencesPerLesson": 0, "minItemsPerSentence": 0,
    "quizPerLesson": 5,
    "allowedQuizTypes": ["picture_choice", "meaning_choice", "listen_choice", "ox"],
    "autoQuiz": true
  }
}
```

- `status`: `live`(열림) / `soon`(목록에 "준비 중"으로만). `lessonCount` 는 적지 않는다 (빌드가 센다).
- `ttsLang`: 소리 내어 읽는 언어 (`en-US`, `ja-JP`, `zh-CN`, `ko-KR`).
- `unlock.afterPackId`: 앞 팩을 끝내야 열린다. `access` 는 표시만 한다 (결제 연결 없음).
- `rules` 의 숫자는 전부 팩 데이터다 (코드에 박힌 숫자 없음). `requiredQuizTypes`, `allowQuizTypeSubstitution`, `minimalPairs` 도 여기서 정한다.
- 레슨 `type`: `phonics`(오늘의 소리) · `vocab`(오늘의 단어) · `listening` · `grammar`(패턴) · `math`(문제). 타입마다 기본 스텝이 있고, 레슨의 `steps` 로 바꿀 수 있다 (`intro cards listen sentences practice patterns quiz`).

## 3. 수학 문제 만들기 (생성기)

레슨에 문제를 적는 대신 규칙만 적는다. 같은 레슨이면 항상 같은 문제가 나온다.

```json
{
  "order": 1, "title": "덧셈 1", "type": "math",
  "generator": { "kind": "arithmetic", "op": "+", "min": 1, "max": 9, "count": 8, "noCarry": true },
  "reviewed": false, "testOnly": true
}
```

`op`: `+ - × ÷` · `noCarry`(덧셈, 받아올림 없음) · `noBorrow`(뺄셈) · `allowNegative`(기본 false). 모든 정답은 `content:check` 가 다시 계산해 맞춰 본다. 한 레슨 안에 같은 식은 나오지 않는다.

## 4. 이미 만든 묶음(번들 JSON)을 넣기

```bash
npm run content:import -- bundle.json              # { "pack": {…}, "items": […], "lessons": […] }
npm run content:import -- bundle.json --force      # 이미 있는 packId 덮어쓰기
```

규칙 검사를 통과해야만 쓴다. 기존 packId 는 `--force` 없이는 거부하고, 검수 완료된 레슨은 `--force-reviewed` 가 더 필요하다.

## 5. 공개까지 — 검수 게이트

레슨마다 두 값이 있다: `reviewed`(사람이 검수 완료) · `testOnly`(시드/테스트 전용). **Production 에 보이는 조건** (`lib/content/visibility.ts` 한 곳에서만 판단):

> 팩 `status` 가 `live` **그리고** 레슨 `reviewed: true` **그리고** `testOnly` 가 아님

- 일부만 검수된 팩은 **처음부터 이어지는 검수된 레슨까지만** 열린다 (1·2·3장이 검수됐고 4장이 아니면 3장까지).
- 공개 레슨이 하나도 없는 `live` 팩은 목록에서도 빠진다. `soon` 팩은 "준비 중"으로만 보인다.
- `NEXT_PUBLIC_DEBUG=true`(Preview)에서는 전부 보이고, 검수 전 레슨에는 "검수 전" 배지가 붙는다.
- Production 빌드는 공개되지 않는 팩을 `public/content/` 파일로도 내보내지 않는다.
- `npm run content:check` 가 팩마다 **Production 공개 레슨 수**를 보여 준다.

공개하려면: 검수표(`content:report`)를 보고 → 레슨 JSON 의 `reviewed` 를 `true`, `testOnly` 를 지우고 → 팩 `status` 를 `live` 로 → `content:check`.

## 6. 시드 (테스트용 대량 데이터)

`npm run content:seed` 가 `content/seed/` 의 원본으로 시드 팩 5개 (수학 덧셈·뺄셈, 영어 동물·출장 여행, 일본어 히라가나)를 만든다. 전부 `testOnly: true`, `reviewed: false` 라서 Production 에는 나가지 않는다.

## 7. 무엇이 어디서 검사되나

| 명령 | 하는 일 |
|---|---|
| `npm run content:check` | 모든 팩 정규화 + 규칙 검사 + 팩별 요약. 에러 있으면 exit 1 |
| `npm run content:build` | `public/content/` 생성 (`predev`·`prebuild` 에서 자동 실행, git 에 커밋하지 않음) |
| `npm run content:report -- <packId>` | 사람 검수용 표 `docs/content-review/<packId>.md` |
