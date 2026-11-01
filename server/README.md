# 셔플보드 백엔드 모듈 (flyer-g-be에 넣을 코드)

전단지 백엔드(`gsainfoteam/flyer-g-be`)와 **같은 구조·같은 규칙**(NestJS + Drizzle, prettier, oxlint)으로 썼습니다.
경로도 그쪽과 같아서 그대로 복사하면 됩니다. **기존 테이블과 기존 코드는 바꾸지 않습니다.** 아래 4줄만 더합니다.

## 넣는 방법

1. 복사
   - `src/shuffleboard/` → flyer-g-be의 `src/shuffleboard/`
   - `src/db/schema.shuffleboard.ts` → `src/db/schema.shuffleboard.ts`
   - `test/shuffleboard.e2e-spec.ts` → `test/shuffleboard.e2e-spec.ts`
   - `drizzle/0015_shuffleboard.sql`, `drizzle/meta/0015_snapshot.json` → 같은 경로
2. 기존 파일에 한 줄씩 더하기
   - `src/db/schema.ts` 맨 끝: `export * from './schema.shuffleboard.js';`
   - `src/app.module.ts`의 `imports`: `ShuffleboardModule`
   - `src/common/errors/error-code.ts`의 `ErrorCode`:
     ```ts
     SHUFFLEBOARD_CLAIMED_BY_OTHER: 'SHUFFLEBOARD_CLAIMED_BY_OTHER',
     SHUFFLEBOARD_BOTH_SEATS: 'SHUFFLEBOARD_BOTH_SEATS',
     ```
   - `drizzle/meta/_journal.json`의 `entries` 끝에 `drizzle/meta/_journal.0015.entry.json`의 내용
     (그사이 다른 마이그레이션이 생겼으면 위 파일 대신 `bun run db:generate`로 새로 만들기)
3. 앱이 뜰 때 마이그레이션이 자동으로 적용됩니다(테이블 4개 추가, 삭제·변경 없음).
4. 관리자가 TV마다 장소를 정합니다: `PUT /shuffleboard/devices/:deviceId/venue` `{ "venue": "old" | "new" }`

## API

| 누가 | 요청 | 하는 일 |
| --- | --- | --- |
| TV (기기 토큰) | `POST /shuffleboard/devices/:deviceId/matches` | 끝난 경기 저장. 같은 경기는 한 번만. 아직 랭킹 아님 |
| 폰 (로그인) | `POST /shuffleboard/claims` | 입장 때 만든 비밀값으로 내 자리를 계정에 연결 |
| 폰 (로그인) | `GET /shuffleboard/survey/me` | 이 계정이 설문을 냈는지 |
| 폰 (로그인) | `POST /shuffleboard/survey` | 설문 저장. 계정당 한 번 |
| 누구나 | `GET /shuffleboard/ranking` | 경기 랭킹 1~3위(닉네임·점수·장소) + 구관/신관 최고 점수 |
| 검토자 | `GET /shuffleboard/survey/responses.csv` | 설문 응답 CSV. 계정 정보 없이 응답만 |
| 관리자 | `PUT /shuffleboard/devices/:deviceId/venue` | TV의 장소(구관/신관) |

**랭킹 규칙:** 경기의 높은 점수를 낸 사람이 로그인해서 자리를 가져가고, 그 계정이 설문을 낸 적이 있으면 그 경기가 랭킹에 오릅니다.
랭킹 여부를 따로 저장하지 않고 읽을 때 계산합니다. 그래서 설문을 나중에 내도, 계정이 지워져도 어긋나지 않습니다.

## 저장되는 것

| 테이블 | 내용 |
| --- | --- |
| `shuffleboard_rooms` | TV별 장소(구관/신관) |
| `shuffleboard_matches` | 경기: 장소, 높은 점수, 승자, 턴별 발사 기록 |
| `shuffleboard_match_players` | 경기의 두 자리: 닉네임, 점수, 비밀값 해시, 가져간 계정 |
| `shuffleboard_survey_responses` | 설문(계정당 하나): 응답, 기타 내용, 제출 시각 |

## 확인한 것

flyer-g-be 복사본에 넣고 실제 Postgres로 확인했습니다.

- `tsc`(build 설정), `oxlint` 통과
- 새 e2e 7개 통과: TV만 보낼 수 있음, 재전송 1번만 저장, 점수·승자 불일치 거절, 결과만으로는 랭킹 아님, 진 사람의 설문으로는 안 오름, 이긴 사람이 설문까지 내야 오름, 설문 계정당 1번, 1~3위, 다른 계정·두 자리·틀린 비밀값 차단, 설문 필수 문항 검증, CSV 권한·계정 정보 제외·수식 방지
- 기존 단위 테스트 177개, 기존 e2e 전체 통과. 단 `target-groups`의 테스트 1개는 **이 모듈 없이도 똑같이 실패**해서(테스트용 Postgres 환경 차이로 보임) 이 변경과 관계없습니다.
- 비공개 패키지 `@gsainfoteam/nest-observability`는 이 환경에서 받을 수 없어, 검증할 때만 빈 구현으로 바꿔 끼웠습니다(추적 기능만 하는 패키지).
