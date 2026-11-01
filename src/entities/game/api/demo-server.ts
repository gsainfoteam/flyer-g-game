import { validateSurvey } from "@/entities/survey/model/questions";
import type { SurveyAnswers } from "@/entities/survey/model/questions";
import { VENUES, venueOfRoom } from "@/shared/config/venue";
import type { Venue } from "@/shared/config/venue";
import type { Seat } from "../model/shuffleboard";
import { ShuffleboardApiError } from "./contract";
import type { ClaimResult, MatchReport, RankingSnapshot, ShuffleboardApi } from "./contract";

/**
 * 데모 서버. 백엔드 없이 흐름 전체를 눌러 볼 수 있게, 서버가 할 일을 이 브라우저
 * 저장소(localStorage)에서 흉내 낸다. 규칙은 백엔드 모듈과 같다.
 *
 * 실제 저장도, 실제 로그인도 아니다. 화면은 데모라고 밝힌다. 운영 빌드에서 쓰지 않는다.
 * TV 탭과 폰 탭이 같은 브라우저라 같은 저장소를 본다.
 */
const STORE_KEY = "flyerg:shuffleboard-demo-server:v1";

interface StoredPlayer {
  seat: Seat;
  name: string;
  score: number;
  claimHash: string | null;
  userId: string | null;
}
interface StoredMatch {
  venue: Venue | null;
  topScore: number;
  finishedAt: number;
  players: StoredPlayer[];
}
interface Store {
  matches: Record<string, StoredMatch>;
  surveys: Record<string, { answers: SurveyAnswers; submittedAt: number }>;
}

function load(): Store {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // 저장소를 못 읽으면 빈 데모로 시작한다.
  }
  return { matches: {}, surveys: {} };
}

function save(store: Store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // 데모라 저장 실패는 무시한다.
  }
}

async function sha256Hex(text: string): Promise<string | null> {
  if (!crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 랭킹 규칙 (백엔드 `ShuffleboardService.ranking`과 같다) */
export function rankMatches(store: Store, limit = 3): RankingSnapshot {
  const eligible = Object.entries(store.matches)
    .map(([matchId, match]) => {
      const holder = match.players.find(
        (player) =>
          player.score === match.topScore &&
          player.userId !== null &&
          store.surveys[player.userId] !== undefined,
      );
      return holder && match.topScore > 0
        ? { matchId, name: holder.name, score: match.topScore, venue: match.venue, at: match.finishedAt }
        : null;
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => b.score - a.score || a.at - b.at);
  const venueBest = Object.fromEntries(
    VENUES.map((venue) => {
      const best = eligible.find((entry) => entry.venue === venue);
      return [venue, best ? best.score : null];
    }),
  ) as Record<Venue, number | null>;
  return {
    top: eligible.slice(0, limit).map(({ matchId, name, score, venue }) => ({ matchId, name, score, venue })),
    venueBest,
  };
}

export function createDemoServer(currentUserId: () => string | null): ShuffleboardApi {
  const requireUser = () => {
    const userId = currentUserId();
    if (!userId) throw new ShuffleboardApiError("UNAUTHENTICATED");
    return userId;
  };

  return {
    demo: true,

    async reportMatch(report: MatchReport) {
      const store = load();
      if (store.matches[report.matchId]) return;
      store.matches[report.matchId] = {
        venue: venueOfRoom(report.roomId),
        topScore: Math.max(0, ...report.players.map((player) => player.score)),
        finishedAt: Date.now(),
        players: report.players.map((player) => ({ ...player, userId: null })),
      };
      save(store);
    },

    async claim(matchId, claimSecret): Promise<ClaimResult> {
      const userId = requireUser();
      const store = load();
      const match = store.matches[matchId];
      if (!match) throw new ShuffleboardApiError("NOT_FOUND");
      const hash = await sha256Hex(claimSecret);
      const mine = match.players.find((player) => hash !== null && player.claimHash === hash);
      if (!mine) throw new ShuffleboardApiError("NOT_FOUND");
      if (mine.userId !== null && mine.userId !== userId) throw new ShuffleboardApiError("CLAIMED_BY_OTHER");
      if (match.players.some((player) => player !== mine && player.userId === userId)) {
        throw new ShuffleboardApiError("BOTH_SEATS");
      }
      mine.userId = userId;
      save(store);
      const ranking = rankMatches(store, Number.MAX_SAFE_INTEGER);
      return {
        seat: mine.seat,
        score: mine.score,
        topScore: match.topScore,
        recordHolder: mine.score === match.topScore,
        surveySubmitted: store.surveys[userId] !== undefined,
        ranked: ranking.top.some((entry) => entry.matchId === matchId),
      };
    },

    async surveyStatus() {
      const userId = requireUser();
      return { submitted: load().surveys[userId] !== undefined };
    },

    async submitSurvey(answers) {
      const userId = requireUser();
      if (validateSurvey(answers).length > 0) throw new ShuffleboardApiError("INVALID");
      const store = load();
      if (store.surveys[userId]) return;
      store.surveys[userId] = { answers, submittedAt: Date.now() };
      save(store);
    },

    async ranking() {
      return rankMatches(load());
    },
  };
}
