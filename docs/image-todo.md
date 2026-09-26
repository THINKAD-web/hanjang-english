# 실사 이미지 교체 대상

MVP 는 이모지로 그림을 보여준다. 아래 단어는 이모지로는 뜻이 잘 전달되지 않거나 기기에 따라 렌더링이 불안정해 추후 실사 이미지로 교체한다.

교체 방법: 이미지를 `public/img/giyeok/<단어>.webp` 에 두고 `content/giyeok/words.json` 의 해당 단어에 `"image": "/img/giyeok/<단어>.webp"` 를 추가한다.
그림 문항에 쓰려면 `imageable` 도 `true` 로 바꾸고 `npm run content:check` 를 돌린다.

| 단어 | 뜻 | 현재 이모지 | 현재 imageable | 사유 |
|---|---|---|---|---|
| glass | 유리, 유리컵 | 🥛 | true | 🥛 는 우유로 읽힘 — 유리컵이 드러나는 사진 필요 |
| globe | 지구본 | 🌍 | true | 🌍 는 지구 — 받침대 있는 지구본 사진 필요 |
| garden | 정원 | 🌷 | false | 꽃 한 송이로는 정원이 전달되지 않음 |
| go | 가다 | 🚶 | false | 걷다와 구별되지 않음 |
| greet | 인사하다 | 👋 | false | 손 흔들기만으로는 부족 |
| grin | 활짝 웃다 | 😁 | false | 웃는 얼굴 이모지가 많아 헷갈림 |
| goose | 거위 | 🪿 | false | 🪿 는 구형 기기에서 렌더되지 않음 — 이미지가 생기면 `imageable: true` 로 되돌린다 |
