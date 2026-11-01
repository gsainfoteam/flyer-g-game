/**
 * 서버가 아는 셔플보드 규칙. 게임 규칙 원본은 프론트의 `shuffleboard-rules.ts`이고,
 * 서버는 받은 값의 범위를 확인하는 데만 쓴다. 규칙을 바꾸면 여기도 맞춘다.
 */
export const SEATS = ['A', 'B'] as const;
export const VENUES = ['old', 'new'] as const;
export const SHOTS_PER_SEAT = 5;
export const TOTAL_TURNS = SHOTS_PER_SEAT * SEATS.length;
/** 한 사람이 낼 수 있는 최대 점수 (원반 5개 × 10점) */
export const MAX_SCORE = SHOTS_PER_SEAT * 10;
/** TV에 띄우는 랭킹 수 */
export const RANKING_SIZE = 3;
