# 전단지 셔플보드 대항전

전단지 로비 TV에서 휴대폰 두 대로 1:1 셔플보드를 하는 게임의 **시제품**입니다.
전단지(flyer-g-fe)의 클릭 배틀과 **같은 모양**으로 만들어서, 전단지에 넣을 때 게임 종류만 바꿔 끼우면 됩니다.

- TV가 심판입니다. 폰은 손을 뗄 때 **각도와 힘만** 보내고, 차례 확인·물리·점수는 TV가 계산합니다. 폰과 TV 사이 지연(약 0.8~0.9초)이 있어도 판정이 흔들리지 않습니다.
- 실시간 통신은 전단지 백엔드의 게임 중계(`games` 모듈)를 그대로 씁니다. **백엔드를 고치지 않아도 됩니다.**
- 로그인·닉네임·랭킹은 없습니다. 설문은 **노션폼**으로 받고, TV 오른쪽 위에 그 QR이 늘 떠 있습니다.

## 실행

```sh
bun install
bun run dev
```

`http://localhost:5173`을 열고 **TV 화면 탭 하나와 폰 화면 탭 두 개**(A팀 QR, B팀 QR)를 띄우면 한 경기를 해 볼 수 있습니다.
`VITE_GAME_SOCKET_URL`을 비워 두면 같은 브라우저의 탭끼리만 이어집니다(개발용).

| 화면 | 주소 |
| --- | --- |
| 구관 TV / 신관 TV | `/games/shuffleboard/old`, `/games/shuffleboard/new` |
| 폰 참가 (TV의 팀별 QR) | `/play/shuffleboard/old?team=A`, `?team=B` |

| 설정 (`.env`) | 내용 |
| --- | --- |
| `VITE_GAME_SOCKET_URL` | 전단지 백엔드 게임 중계 주소 (`wss://…/games/ws`). 비우면 같은 브라우저 탭끼리 |
| `VITE_SURVEY_URL` | 설문 노션폼 공개 주소(https). TV 오른쪽 위 QR과 폰 결과 화면 버튼이 이 주소로 감 |

```sh
bun run test    # 엔진 테스트 (입장, 차례, 시간 초과, 중복 발사, 물리, 점수)
bun run lint    # 전단지와 같은 lint 규칙 (feature끼리 import 금지 등)
bun run build
```

## 화면

- **TV 대기:** 클릭 배틀과 같은 비율로 A팀·B팀 패널이 반씩. 각 패널 오른쪽 아래에 그 팀 QR. 오른쪽 위에 설문 QR.
- **TV 경기 중:** 보드(가로)와 두 팀 점수·남은 원반. 오른쪽 위 설문 QR은 그대로.
- **폰:** 팀 QR을 찍으면 버튼 하나로 참가 → 새총 방식으로 조준·발사 → 경기가 끝나면 결과와 "설문 참여하기 / 건너뛰기". 어느 쪽이든 "끝났어요" 화면으로 마무리. 다시 하기는 **클릭 배틀과 같은 규칙**: 결과(10초) 뒤 방이 비면 같은 화면에 "다시 참가하기" 버튼이 나타나고, 누르면 다시 참가(자동 재경기·우선권 없음).
- **보드:** 점수 없는 구간은 차분한 회색, 점수 칸만 채도 낮은 파랑(10점 쪽으로 갈수록 진함), 끝의 10점 칸은 초록(GamePigeon 사진 참고). 색은 `index.css`의 `--color-board-*` 토큰.

## 게임 규칙

규칙 값은 모두 `src/entities/game/model/shuffleboard-rules.ts` 한 파일에 있습니다.

| 항목 | 값 |
| --- | --- |
| 입장 | TV마다 팀별 QR 두 개. 찍은 QR의 팀 자리에 앉음. 찬 팀 QR을 찍으면 다른 QR을 안내. 로그인·닉네임 없음 |
| 시작 | 두 명이 모이면 3초 뒤 |
| 차례 | A팀부터 번갈아, 각 5번. 한 턴 10초, 넘기면 원반 없이 0점 |
| 조작 | 새총 방식. 아래로 당긴 길이가 힘, 당긴 방향의 반대가 조준 방향 |
| 점수 | 보드 끝에서부터 10 · 7 · 3 · 2점. **경기가 끝났을 때 보드에 남은 원반 위치**로 계산(상대 원반을 밀어낼 수 있음). 끝을 넘으면 0점, 파울 선을 못 넘은 원반은 치움 |
| 경기 중 연결 끊김 | (보류) 지금은 기권 없이 자리를 지킴. 같은 탭으로 돌아오면 이어 하고, 안 오면 그 사람 턴만 시간 초과로 넘어감 |

## 전단지에 넣는 방법

폴더 구조와 lint 규칙을 flyer-g-fe와 똑같이 맞췄습니다. 같은 경로에 복사하면 됩니다.

| 이 레포 | 전단지에서 |
| --- | --- |
| `src/entities/game/model/shuffleboard*.ts` | 그대로 복사 |
| `src/features/shuffleboard/` | 그대로 복사. `api/game-socket.ts`는 빼고 클릭 배틀의 `gameSocketBase()`를 import. `model/player-binding.ts`는 클릭 배틀 것과 같은 파일이라 `shared`로 옮겨 함께 써도 됨 |
| `src/pages/Shuffleboard*.tsx` | 그대로 복사 |
| `src/shared/config/survey.ts` | 복사하고 전단지 `.env`에 `VITE_SURVEY_URL` 추가 |
| `src/shared/config/routes.ts`의 셔플보드 두 줄 | 전단지 `routes.ts`의 `paths`·`to`에 추가 |
| `src/shared/config/venue.ts` | 복사 후 `venueOfRoom()`만 기기 설정의 장소(구관/신관)를 읽도록 변경. TV 머리 줄에 장소 이름을 띄우는 데만 씀 |

그다음 TV 위젯 순환에 넣습니다. `ShuffleboardWidget`은 `BattleWidget`과 **props가 똑같습니다.**

1. 위젯 종류에 `SHUFFLEBOARD`를 추가합니다(`entities/widget/model/types.ts`, `content.ts`, `settings.ts`). 클릭 배틀을 아예 바꿀 거라면 이 단계 없이 2번만 하면 됩니다.
2. `pages/DisplayPage.tsx`에서 `CLICK_BATTLE`일 때 `<BattleWidget … />`를 그리는 자리에 같은 방식으로 `<ShuffleboardWidget … />`를 그립니다.
3. 라우터에 `ShuffleboardTvPage`(TV 단독 화면)와 `ShuffleboardPlayPage`(폰, `PlayLayout` 아래)를 추가합니다.

## 지난 버전

인포팀 로그인, 게임 안 설문, 경기 랭킹, 이를 저장하는 백엔드 모듈(`server/`)을 만들었다가 뺐습니다.
필요해지면 git 기록의 `bad587a`(백엔드 모듈)와 `fcdfec0`(랭킹을 띄우던 TV 화면)에서 꺼내 쓸 수 있습니다.

## 정해야 할 것

- 설문 노션폼 주소 (`VITE_SURVEY_URL`)
- 경기 중 연결이 끊긴 사람의 처리(기권/취소 정책) — `SHUFFLEBOARD_RULES.disconnectPolicy`
- 점수 구역과 발사 횟수 확정 — 지금은 명세서의 MVP 제안값
