# 전단지 셔플보드 대항전

전단지 로비 TV에서 휴대폰 두 대로 1:1 셔플보드를 하는 게임의 **시제품**입니다.
전단지(flyer-g-fe)의 클릭 배틀과 **같은 모양**으로 만들어서, 전단지에 넣을 때 게임 종류만 바꿔 끼우면 됩니다.
경기 뒤 설문과 랭킹을 저장하는 서버 코드는 `server/`에 전단지 백엔드(flyer-g-be) 모양으로 들어 있습니다.

- TV가 심판입니다. 폰은 손을 뗄 때 **각도와 힘만** 보내고, 차례 확인·물리·점수는 TV가 계산합니다. 그래서 폰과 TV 사이 지연(약 0.8~0.9초)이 있어도 판정이 흔들리지 않습니다.
- 실시간 통신은 전단지 백엔드의 게임 중계(`games` 모듈)를 그대로 씁니다.
- **경기 → 인포팀 로그인 → (처음이면) 설문 → 랭킹** 순서입니다. 설문은 게임 안에서 바로 받고, 계정당 한 번만 묻습니다.

## 실행

```sh
bun install
bun run dev
```

`http://localhost:5173`을 열고 **TV 화면 탭 하나와 폰 화면 탭 두 개**(A팀 QR, B팀 QR)를 띄우면 경기부터 설문·랭킹까지 해 볼 수 있습니다.
서버 주소를 비워 두면 같은 브라우저의 탭끼리 이어지고, 로그인과 저장은 **데모**(이 브라우저 안)로 흉내 냅니다. 화면에 데모라고 표시됩니다.

| 화면 | 주소 |
| --- | --- |
| 구관 TV / 신관 TV | `/games/shuffleboard/old`, `/games/shuffleboard/new` |
| 폰 참가 (TV의 팀별 QR) | `/play/shuffleboard/old?team=A`, `?team=B` |

```sh
bun run test    # 엔진·설문·랭킹 규칙 테스트
bun run lint    # 전단지와 같은 lint 규칙 (feature끼리 import 금지 등)
bun run build
```

## 규칙

게임 규칙 값은 모두 `src/entities/game/model/shuffleboard-rules.ts` 한 파일에 있습니다.

| 항목 | 값 |
| --- | --- |
| 입장 | TV마다 팀별 QR 두 개(A팀, B팀). 찍은 QR의 팀 자리에 앉음. 찬 팀 QR을 찍으면 다른 QR을 안내 |
| 시작 | 두 명이 모이면 3초 뒤 |
| 차례 | A팀부터 번갈아, 각 5번. 한 턴 10초, 넘기면 원반 없이 0점 |
| 조작 | 새총 방식. 아래로 당긴 길이가 힘, 당긴 방향의 반대가 조준 방향 |
| 점수 | 보드 끝에서부터 10 · 7 · 3 · 2점. **경기가 끝났을 때 보드에 남은 원반 위치**로 계산(상대 원반을 밀어낼 수 있음). 끝을 넘으면 0점, 파울 선을 못 넘은 원반은 치움 |
| 닉네임 | 입장할 때 입력. 경기 화면은 A팀/B팀으로만 부르고, 닉네임은 TV 랭킹에만 표시. 로그인 계정 이름은 TV에 띄우지 않음 |
| 설문 | 경기 뒤 인포팀 로그인 → 9문항(1~7번 필수, 8·9번 선택). **계정당 한 번**, 다시 플레이하면 묻지 않음 |
| 랭킹 | **경기 단위**. 그 경기의 높은 점수를 낸 사람이 로그인하고 설문까지 냈으면 그 점수가 오름. TV에는 **1~3위**와 **구관/신관 최고 점수** |
| 경기 중 연결 끊김 | (보류) 지금은 기권 없이 자리를 지킴. 같은 탭으로 돌아오면 이어 하고, 안 오면 그 사람 턴만 시간 초과로 넘어감 |

## 전단지에 넣는 방법

### 프론트 (flyer-g-fe)

폴더 구조와 lint 규칙을 flyer-g-fe와 똑같이 맞췄습니다. 같은 경로에 복사하면 됩니다.

| 이 레포 | 전단지에서 |
| --- | --- |
| `src/entities/game/model/shuffleboard*.ts`, `src/entities/game/api/` | 그대로 복사 (`name-filter.ts`는 이미 있음). `demo-server.ts`는 운영에 쓰지 않음 |
| `src/entities/survey/`, `src/entities/ranking/` | 그대로 복사 |
| `src/features/shuffleboard/` | 그대로 복사. 아래 두 파일만 전단지 것으로 연결 |
| └ `api/game-socket.ts` | 빼고, 클릭 배틀의 `gameSocketBase()`를 import |
| └ `api/player-auth.ts`, `api/index.ts` | 데모 로그인 대신 전단지 `features/auth`(인포팀 PKCE 로그인)를 감싼 `PlayerAuth`를 넣고, `createHttpShuffleboardApi(API 주소, 토큰 가져오기)`를 씀 |
| `src/pages/Shuffleboard*.tsx` | 그대로 복사 |
| `src/shared/config/routes.ts`의 셔플보드 두 줄 | 전단지 `routes.ts`의 `paths`·`to`에 추가 |
| `src/shared/config/venue.ts` | 복사 후 `venueOfRoom()`만 기기의 장소를 읽도록 변경(서버는 이미 기기별 장소를 앎) |

그다음 TV 위젯 순환에 넣습니다. `ShuffleboardWidget`은 `BattleWidget`과 **props가 똑같습니다.**

1. 위젯 종류에 `SHUFFLEBOARD`를 추가합니다(`entities/widget/model/types.ts`, `content.ts`, `settings.ts`). 클릭 배틀을 아예 바꿀 거라면 이 단계 없이 2번만 하면 됩니다.
2. `pages/DisplayPage.tsx`에서 `CLICK_BATTLE`일 때 `<BattleWidget … />`를 그리는 자리에 같은 방식으로 `<ShuffleboardWidget … />`를 그립니다.
3. 라우터에 `ShuffleboardTvPage`(TV 단독 화면)와 `ShuffleboardPlayPage`(폰, `PlayLayout` 아래)를 추가합니다.

### 백엔드 (flyer-g-be)

`server/README.md`를 보세요. 모듈 폴더 하나와 테이블 4개를 **추가**하고, 기존 파일에는 한 줄씩 4군데만 더합니다.
전단지 백엔드 복사본에 넣어 실제 Postgres로 e2e 테스트까지 확인했습니다.

## 기록이 내 것임을 증명하는 방법

경기 전에는 로그인하지 않으므로, 폰이 입장할 때 비밀값을 하나 만들어 혼자 간직하고 **해시만** TV로 보냅니다.
TV 상태는 방의 모든 폰에 보이지만 해시로는 비밀값을 알 수 없습니다. 경기 뒤 로그인한 폰이 비밀값을 서버에 내면 서버가 해시를 대조해 그 자리를 계정에 연결합니다.
다른 계정이 이미 가져간 자리, 한 계정이 한 경기의 두 자리를 다 가져가는 것은 막습니다.

## 정해야 할 것

- 경기 중 연결이 끊긴 사람의 처리(기권/취소 정책) — `SHUFFLEBOARD_RULES.disconnectPolicy`
- 점수 구역과 발사 횟수 확정 — 지금은 명세서의 MVP 제안값
- 백엔드에 셔플보드 모듈을 추가해도 되는지(처음 명세의 "기존 전단지 코드·DB는 수정하지 않는다"와 부딪힘)
- 인포팀 로그인: 전단지 클라이언트를 같이 쓰면 새로 등록할 것이 없음
- 개인정보 보관·삭제 기준(설문 응답은 계정과 연결돼 저장되고, 내려받을 때는 응답만 나감)
