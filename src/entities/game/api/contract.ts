import type { Seat, ShotLog } from "../model/shuffleboard";
import type { SurveyAnswers } from "@/entities/survey/model/questions";
import type { Venue } from "@/shared/config/venue";

/**
 * 셔플보드 서버 계약. 백엔드 모듈(`server/src/shuffleboard`)의 API와 1:1로 맞춘다.
 *
 * 흐름 (명세 7장, 바뀐 결정 반영)
 * 1. 경기 종료 → TV가 결과를 보낸다(`reportMatch`). 아직 랭킹 아님.
 * 2. 폰에서 인포팀 로그인 → 폰만 아는 비밀값으로 "이 자리는 내 것"을 증명(`claim`).
 * 3. 그 계정이 설문을 낸 적이 없으면 설문(`submitSurvey`). 계정당 한 번만.
 * 4. 경기의 높은 점수를 낸 사람이 로그인+설문을 마치면 그 경기가 랭킹에 오른다.
 */
export interface MatchReport {
  matchId: string;
  /**
   * TV의 방 id. 실제 서버는 기기 토큰으로 기기와 장소를 정하므로 이 값을 믿지 않는다
   * (기기 id와 다르면 거절). 데모 서버는 장소를 정하는 데 쓴다.
   */
  roomId: string;
  players: Array<{ seat: Seat; name: string; claimHash: string | null; score: number }>;
  winner: Seat | "DRAW";
  shots: ShotLog[];
}

export interface ClaimResult {
  seat: Seat;
  score: number;
  /** 이 경기의 높은 점수(랭킹에 오르는 점수) */
  topScore: number;
  /** 내 점수가 이 경기의 높은 점수인가. 그래야 내 로그인·설문으로 이 경기가 랭킹에 오른다. */
  recordHolder: boolean;
  /** 이 계정이 설문을 이미 냈는가 */
  surveySubmitted: boolean;
  /** 이 경기가 지금 랭킹에 들어가 있는가 */
  ranked: boolean;
}

export interface RankingEntry {
  matchId: string;
  /** 높은 점수를 낸 사람의 닉네임. 로그인 계정 이름은 싣지 않는다. */
  name: string;
  score: number;
  venue: Venue | null;
}

export interface RankingSnapshot {
  /** 경기 기록 1~3위 */
  top: RankingEntry[];
  /** 장소별 최고 점수. TV 오른쪽 위에 띄운다. */
  venueBest: Record<Venue, number | null>;
}

export type ShuffleboardErrorCode =
  | "UNAUTHENTICATED"
  /** 경기 기록이 아직 서버에 없다(TV가 보내는 중일 수 있다) */
  | "NOT_FOUND"
  /** 다른 계정이 이미 이 자리를 가져갔다 */
  | "CLAIMED_BY_OTHER"
  /** 같은 계정으로 한 경기의 두 자리를 다 가져가려 했다 */
  | "BOTH_SEATS"
  | "INVALID"
  | "NETWORK";

export class ShuffleboardApiError extends Error {
  readonly code: ShuffleboardErrorCode;
  constructor(code: ShuffleboardErrorCode, message = code) {
    super(message);
    this.code = code;
  }
}

export interface ShuffleboardApi {
  /** 데모(브라우저 안에만 저장)인가. 화면이 "데모"라고 밝힌다. */
  readonly demo: boolean;
  /** TV → 서버. 기기 토큰으로 인증한다. 같은 경기를 두 번 보내도 한 번만 저장한다. */
  reportMatch(report: MatchReport, deviceToken: string | null): Promise<void>;
  /** 로그인한 폰 → 서버. 비밀값 원문은 이 요청에서만 보낸다(https). */
  claim(matchId: string, claimSecret: string): Promise<ClaimResult>;
  surveyStatus(): Promise<{ submitted: boolean }>;
  /** 계정당 한 번. 이미 냈으면 조용히 성공으로 본다. */
  submitSurvey(answers: SurveyAnswers): Promise<void>;
  ranking(): Promise<RankingSnapshot>;
}

export const EMPTY_RANKING: RankingSnapshot = {
  top: [],
  venueBest: { old: null, new: null },
};
