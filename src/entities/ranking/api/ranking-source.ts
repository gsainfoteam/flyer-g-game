import type { Venue } from "@/shared/config/venue";

/**
 * 랭킹을 읽어 오는 곳.
 *
 * 랭킹에는 "인포팀 로그인 + 구글폼 실제 제출"이 모두 확인된 기록만 들어간다(명세 8장).
 * 그 확인은 서버만 할 수 있으므로 서버가 생기기 전에는 빈 랭킹을 돌려준다. 가짜
 * 순위를 지어내 보여 주지 않는다. 서버가 생기면 `createHttpRankingSource`를 더한다.
 */
export interface RankingEntry {
  /** 경기 전에 적은 닉네임. 로그인 계정의 실명은 공용 TV에 띄우지 않는다. */
  name: string;
  score: number;
}

export interface RankingSnapshot {
  /** 개인 최고 점수 순위 */
  top: RankingEntry[];
  /** 장소별 최고 점수. TV 오른쪽 위에 띄운다. */
  venueBest: Record<Venue, number | null>;
  /** 장소별 누적 점수 */
  venueTotal: Record<Venue, number>;
}

export interface RankingSource {
  /** 서버에 붙은 실제 랭킹인가. 아니면 화면이 "서버 연결 전"을 밝힌다. */
  readonly live: boolean;
  load(): Promise<RankingSnapshot>;
}

export const EMPTY_RANKING: RankingSnapshot = {
  top: [],
  venueBest: { old: null, new: null },
  venueTotal: { old: 0, new: 0 },
};

export const offlineRankingSource: RankingSource = {
  live: false,
  load: async () => EMPTY_RANKING,
};
