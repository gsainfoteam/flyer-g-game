# 전단지 셔플보드 대항전

전단지 로비 TV에서 휴대폰 두 대로 1:1 셔플보드를 하는 게임의 **시제품**입니다.
전단지(flyer-g-fe)의 클릭 배틀과 **같은 모양**으로 만들어서, 전단지에 넣을 때 게임 종류만 바꿔 끼우면 됩니다.

- TV가 심판입니다. 폰은 손을 뗄 때 **각도와 힘만** 보내고, 차례 확인·물리·점수는 TV가 계산합니다. 그래서 폰과 TV 사이 지연(약 0.8~0.9초)이 있어도 판정이 흔들리지 않습니다.
- 통신은 전단지 백엔드의 게임 중계(`flyer-g-be`의 `games` 모듈)를 그대로 씁니다. **백엔드를 고치지 않아도 게임은 돌아갑니다.**
- 랭킹, 로그인 뒤 기록 연결, 구글폼 제출 확인은 아직 없습니다(아래 "아직 없는 것").

## 실행

```sh
bun install
bun run dev
```

`http://localhost:5173`을 열고 **TV 화면 탭 하나와 폰 화면 탭 두 개**를 나란히 띄우면 한 경기를 할 수 있습니다.
`VITE_GAME_SOCKET_URL`을 비워 두면 같은 브라우저의 탭끼리만 이어집니다(개발용).

| 화면 | 주소 |
| --- | --- |
| 구관 TV | `/games/shuffleboard/old` |
| 신관 TV | `/games/shuffleboard/new` |
| 폰 참가 (TV의 QR) | `/play/shuffleboard/old`, `/play/shuffleboard/new` |

실제 휴대폰으로 하려면 `.env`에 전단지 백엔드의 중계 주소를 넣고, TV는 전단지 기기 설정 링크(`#token=`)로 엽니다.

```sh
bun run test    # 엔진 테스트 (입장, 차례, 시간 초과, 중복 발사, 물리, 점수)
bun run lint    # 전단지와 같은 lint 규칙 (feature끼리 import 금지 등)
bun run build
```

## 게임 규칙

규칙 값은 모두 `src/entities/game/model/shuffleboard-rules.ts` 한 파일에 있습니다.

| 항목 | 값 |
| --- | --- |
| 입장 | TV마다 팀별 QR 두 개(A팀 QR, B팀 QR). 찍은 QR의 팀 자리에 앉음. 이미 찬 팀 QR을 찍으면 다른 팀 QR을 안내 |
| 시작 | 두 명이 모이면 3초 뒤 |
| 차례 | A팀부터 번갈아, 각 5번 |
| 턴 제한 | 10초. 넘기면 원반 없이 0점으로 넘어감 |
| 조작 | 새총 방식. 아래로 당긴 길이가 힘, 당긴 방향의 반대가 조준 방향 |
| 점수 구역 | 보드 끝에서부터 10 · 7 · 3 · 2점. 끝을 넘으면 떨어져서 0점 |
| 점수 계산 | **경기가 끝났을 때 보드에 남은 원반 위치**로 계산. 상대 원반을 밀어내면 상대 점수가 줄어듦 |
| 파울 선 | 보드 가운데 선을 못 넘고 멈춘 원반은 치움 |
| 닉네임 | 입장할 때 입력. 경기 화면은 A팀/B팀으로만 부르고, 닉네임은 TV 랭킹에만 표시 |
| 경기 중 연결 끊김 | (보류) 지금은 기권 없이 자리를 지킴. 같은 탭으로 돌아오면 이어 하고, 안 오면 그 사람 턴만 시간 초과로 넘어감 |

## 전단지에 넣는 방법

폴더 구조와 lint 규칙을 flyer-g-fe와 똑같이 맞췄습니다. 아래 폴더를 같은 경로에 복사하면 됩니다.

| 이 레포 | 전단지에서 |
| --- | --- |
| `src/entities/game/model/shuffleboard*.ts` | 그대로 복사 (`name-filter.ts`는 이미 있음) |
| `src/entities/ranking/` | 그대로 복사 (서버가 생기면 실제 랭킹 소스를 여기에 추가) |
| `src/features/shuffleboard/` | 그대로 복사. 단 `api/game-socket.ts`는 빼고 클릭 배틀의 `gameSocketBase()`를 쓰도록 import만 바꾸기. `model/player-binding.ts`는 클릭 배틀 것과 같은 파일이라 `shared`로 옮겨 함께 써도 됨 |
| `src/pages/Shuffleboard*.tsx` | 그대로 복사 |
| `src/shared/config/routes.ts`의 셔플보드 두 줄 (폰 주소는 클릭 배틀처럼 `?team=A`) | 전단지 `routes.ts`의 `paths`·`to`에 추가 |
| `src/shared/config/venue.ts` | 복사 후 `venueOfRoom()`만 "기기 설정의 장소(구관/신관)"를 읽도록 변경 |

그다음 TV 위젯 순환에 넣습니다. `ShuffleboardWidget`은 `BattleWidget`과 **props가 똑같습니다.**

1. 위젯 종류에 `SHUFFLEBOARD`를 추가합니다(`entities/widget/model/types.ts`, `content.ts`, `settings.ts`). 클릭 배틀을 아예 바꿀 거라면 이 단계 없이 2번만 하면 됩니다.
2. `pages/DisplayPage.tsx`에서 `CLICK_BATTLE`일 때 `<BattleWidget … />`를 그리는 자리 옆에 같은 방식으로 `<ShuffleboardWidget … />`를 그립니다.
3. 라우터에 `ShuffleboardTvPage`(TV 단독 화면)와 `ShuffleboardPlayPage`(폰, `PlayLayout` 아래)를 추가합니다.

## 아직 없는 것 (서버가 필요한 부분)

명세서 7~8장의 흐름입니다. 게임 쪽에는 서버를 붙일 **자리를 미리 만들어 두었고**, 서버가 없는 동안 성공한 것처럼 보이는 가짜 흐름은 만들지 않았습니다.

| 할 일 | 붙일 자리 |
| --- | --- |
| 경기 종료 시 두 사람 점수 임시 저장 (`pending_auth`) | `useShuffleboardHost`의 `onMatchFinished(result)`. TV가 기기 토큰으로 서버에 보내면 됩니다 |
| 로그인 뒤 "이 기록이 내 것" 확인 | 폰이 입장할 때 비밀값을 만들어 **해시만** TV에 보냅니다(`claimHash`). 로그인 후 폰이 비밀값(`FinishedMatch.claimSecret`)을 서버에 내면 해시와 대조합니다. 비밀값은 다른 폰에 보이지 않습니다 |
| 인포팀 로그인 | 전단지 FE의 `features/auth`(PKCE)와 BE의 `/auth/login`을 그대로 쓰면 됩니다 |
| 구글폼 제출 확인 | 서버가 일회용 확인 코드를 발급 → 폼에 미리 채움 → Apps Script `onFormSubmit` 트리거가 서버 웹훅 호출 → 서버가 기록을 `eligible`로 변경 |
| 랭킹 | `entities/ranking/api/ranking-source.ts`에 서버 소스를 추가. TV에는 **닉네임만** 띄웁니다(로그인 계정의 실명은 띄우지 않음) |

위 서버 기능은 전단지 백엔드에 모듈 하나(`shuffleboard`)와 테이블 몇 개를 **추가**하는 방식을 제안합니다. 기존 코드는 모듈 등록 한 줄 정도만 바뀝니다. 다만 처음 명세의 "기존 전단지 코드·DB는 수정하지 않는다" 원칙과 부딪히므로, 진행 전에 확인이 필요합니다.

## 정해야 할 것

- 경기 중 연결이 끊긴 사람의 처리(기권/취소 정책) — `SHUFFLEBOARD_RULES.disconnectPolicy`
- 점수 구역과 발사 횟수 확정 — 지금은 명세서의 MVP 제안값
- 인포팀 IdP 클라이언트(전단지 것을 같이 쓸지), 구글폼 주소와 확인 코드 항목 ID
- 개인정보 보관·삭제 기준
