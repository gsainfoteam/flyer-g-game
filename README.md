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

## 진짜 휴대폰으로 해 보기

```sh
bun install
bun run play:lan
```

앱을 빌드하고, 같은 포트에서 앱과 게임 중계를 함께 여는 **개발용 서버**(`scripts/lan-server.mjs`)를 켭니다.
중계 규칙은 전단지 백엔드 중계와 같고, 기기 토큰만 확인하지 않습니다.

1. 터미널에 나온 **TV 화면 주소**(`http://<컴퓨터 IP>:5180/games/shuffleboard/old#token=dev`)를 컴퓨터 브라우저로 엽니다. `localhost`가 아니라 IP 주소로 열어야 QR에 폰이 들어올 수 있는 주소가 들어갑니다.
2. 폰을 **컴퓨터와 같은 Wi-Fi**에 연결하고 TV 화면의 팀 QR을 찍습니다. 폰이 한 대면 다른 팀은 컴퓨터의 다른 브라우저(또는 시크릿 창)로 그 팀 QR 주소를 열면 됩니다.
3. 설문 QR까지 보려면 `.env.lan`의 `VITE_SURVEY_URL=` 뒤에 노션폼 주소를 넣고 다시 실행합니다.

폰이 접속하지 못하면: 기숙사·학교 Wi-Fi는 기기끼리 통신을 막는 경우가 많습니다. 폰 핫스팟에 컴퓨터를 연결해서 해 보세요. Windows에서 처음 실행할 때 방화벽 허용 창이 뜨면 "허용"을 눌러야 합니다.

## 화면

- **TV 대기:** 클릭 배틀과 같은 비율로 A팀·B팀 패널이 반씩. 각 패널 오른쪽 아래에 그 팀 QR. 오른쪽 위에 설문 QR.
- **TV 경기 중:** 보드(가로)와 두 팀 점수·남은 원반. 오른쪽 위 설문 QR은 그대로.
- **폰:** 팀 QR을 찍으면 버튼 하나로 참가 → 화면 가운데 큰 원반을 당겨 조준·발사(폰에는 보드가 없어 TV를 보고 감으로 던짐) → 경기가 끝나면 결과와 "설문 참여하기 / 건너뛰기". 어느 쪽이든 "끝났어요" 화면으로 마무리. 다시 하기는 **클릭 배틀과 같은 규칙**: 결과(10초) 뒤 방이 비면 같은 화면에 "다시 참가하기" 버튼이 나타나고, 누르면 다시 참가(자동 재경기·우선권 없음).
- **튜토리얼:** 참가 화면과 상대를 기다리는 동안 그림과 세 줄짜리 "이렇게 던져요"를 보여 주고, 첫 차례에는 패드 위에 아래로 당기는 손가락이 움직여요(한 번 던지면 사라짐).
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

셔플보드는 클릭 배틀을 바꾸지 않고 **새 위젯(`SHUFFLEBOARD`)으로 따로 추가**합니다.
전단지 최신 main(`38756e5`)에 그대로 붙여 확인했어요(타입 검사, lint, 테스트, 빌드 통과).
폴더 구조와 lint 규칙이 flyer-g-fe와 같아서 대부분 같은 경로에 복사하면 됩니다.

### 1. 파일 복사

| 이 레포 | 전단지에서 |
| --- | --- |
| `src/entities/game/model/shuffleboard*.ts` (테스트 포함) | 그대로 복사 |
| `src/features/shuffleboard/` | 그대로 복사. 단, `api/game-socket.ts`는 빼고 클릭 배틀의 `gameSocketBase()`를 import. `model/player-binding.ts`는 클릭 배틀 것과 같은 파일이라 `shared`로 옮겨 같이 써도 됨 |
| `src/pages/ShuffleboardTvPage.tsx`, `ShuffleboardPlayPage.tsx` | 복사 후 설문 주소를 `surveyQr()` 대신 `operation.ts`의 `SURVEY_URL`로 바꿈 |
| `src/shared/config/venue.ts` | 복사. TV 머리 줄의 구관/신관 이름에만 씀 |
| `src/shared/config/survey.ts` | 복사하지 않음 (전단지는 `SURVEY_URL`을 씀) |

### 2. 고칠 파일

| 파일 | 할 일 |
| --- | --- |
| `entities/widget/model/types.ts` | 위젯 종류에 `"SHUFFLEBOARD"` 추가, 기본 비율 `SHUFFLEBOARD: 20` |
| `entities/widget/model/content.ts` | 내용 타입에 `{ type: "SHUFFLEBOARD" }`, 읽는 `switch`에 case 추가 |
| `entities/widget/model/feed.ts` | 단독 화면 위젯 목록에 `"SHUFFLEBOARD"` 추가 |
| `entities/widget/model/settings.ts` | 이름 `"셔플보드"`와 설명 한 줄 추가. 관리자 화면의 위젯 고르는 목록에 이 이름으로 나옴 |
| `entities/widget/ui/WidgetDisplay.tsx` | `case "SHUFFLEBOARD":`를 `CLICK_BATTLE` 옆에 붙임 (플레이어가 따로 그림) |
| `pages/DisplayPage.tsx` | `GAME_WIDGETS = ["CLICK_BATTLE", "SHUFFLEBOARD"]`를 만들어 `CLICK_BATTLE`만 비교하던 두 곳(게임을 열 수 없는 TV에서 빼기, 시간대 규칙)을 바꿈. `BattleWidget`을 그리는 자리 옆에 같은 props로 `<ShuffleboardWidget … />` 분기 추가 (props가 `BattleWidget`과 똑같음) |
| `shared/config/routes.ts` | `paths`와 `to`에 `shuffleboard`(`/games/shuffleboard/:roomId`), `playShuffleboard`(`/play/shuffleboard/:roomId`) 추가 |
| `app/router/route-tree.tsx` | `ShuffleboardTvPage`는 TV 단독 화면으로, `ShuffleboardPlayPage`는 `PlayLayout` 아래에 추가 |
| `index.css` | `@theme`에 보드 색 토큰 `--color-board-*` 8줄 추가 (이 레포 `index.css`에서 복사) |
| 테스트 2개 | 위젯 개수 `10 → 11`: `http-widget-repository.test.ts`(두 곳, 목록에 `"SHUFFLEBOARD"`도 추가), `widget-settings-form.test.ts` |

### 3. TV에 띄우기

게임 시간대는 관리자 화면에서 고르는 방식으로 바뀌는 중입니다. 위 2번에서 위젯 종류(`types.ts`)와 이름(`settings.ts`)을 등록하면,
관리자 화면에서 시간대의 위젯으로 **셔플보드**를 고를 수 있으면 됩니다. 시간대 화면을 만들 때 위젯 목록을 손으로 적는다면 `SHUFFLEBOARD`도 넣어 주세요.
셔플보드 시간대에도 클릭 배틀처럼 설문 링크(`survey`)를 같이 넘기면 TV 오른쪽 위 설문 QR이 뜹니다.

### 백엔드

**게임 쪽은 할 일 없음.** 클릭 배틀과 같은 게임 중계(`/games/ws`)와 기기 토큰 인증을 그대로 씁니다.
실제 flyer-g-be로 틀린 토큰 거부, TV 연결, 폰 두 대 참가, 한 판 끝까지를 확인했어요. 다음 경우에만 백엔드를 봐야 합니다.

- **시간대·위젯 설정을 백엔드에 저장한다면:** 저장할 때 위젯 종류를 검사하는 목록에 `SHUFFLEBOARD`를 추가해야 합니다. 빠지면 관리자 화면에서 셔플보드를 골라도 저장이 거절되거나 TV에서 빠집니다.
- **셔플보드를 전단지 프론트와 다른 도메인에서 띄운다면:** 그 주소를 `CORS_ALLOWED_ORIGINS`에 추가해야 합니다. 안 하면 게임 중계 접속이 403으로 막힙니다. 같은 도메인이면 필요 없습니다.

## 지난 버전

인포팀 로그인, 게임 안 설문, 경기 랭킹, 이를 저장하는 백엔드 모듈(`server/`)을 만들었다가 뺐습니다.
필요해지면 git 기록의 `bad587a`(백엔드 모듈)와 `fcdfec0`(랭킹을 띄우던 TV 화면)에서 꺼내 쓸 수 있습니다.

## 정해야 할 것

- 경기 중 연결이 끊긴 사람의 처리(기권/취소 정책) — `SHUFFLEBOARD_RULES.disconnectPolicy`
- 점수 구역과 발사 횟수 확정 — 지금은 명세서의 MVP 제안값
