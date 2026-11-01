import { hasBlockedWord, stripInvisible } from "./name-filter";
import { clampShot, scorePucks, simulateShot } from "./shuffleboard-physics";
import type { Puck } from "./shuffleboard-physics";
import { SEATS, SHUFFLEBOARD_RULES } from "./shuffleboard-rules";
import type { Seat } from "./shuffleboard-rules";

/**
 * 셔플보드 1:1 경기. A팀(먼저 온 사람)과 B팀(두 번째)이 번갈아 원반을 던진다.
 *
 * TV가 심판이다(클릭 배틀과 같다). 폰은 "각도와 힘"만 보내고, 차례 확인·물리·점수·
 * 시간은 모두 TV가 한다. 폰이 보낸 점수는 받지 않는다. (명세 6장)
 *
 * 흐름: WAITING(0~1명, QR) → READY(2명, 3초 카운트다운) → PLAYING(번갈아 던짐)
 * → FINISHED(결과) → 방을 비우고 새 경기로 WAITING. 결과 뒤 로그인·설문은 각자 폰에서
 * 따로 이어지므로 방은 바로 다음 참가자를 받는다. (명세 4장)
 *
 * 이 파일은 시간과 전송을 모르는 순수 함수다. 시각과 새 경기 id는 호출부가 넘긴다.
 */
export { SEATS };
export type { Seat };

export type MatchPhase = "WAITING" | "READY" | "PLAYING" | "FINISHED";

export interface SeatPlayer {
  playerId: string;
  /** 랭킹에 쓸 닉네임. 경기 화면에는 띄우지 않고 A팀/B팀으로 부른다. */
  name: string;
  /**
   * 폰만 아는 비밀값의 해시. 경기 뒤 로그인한 사람이 "이 기록이 내 것"임을 서버에
   * 증명할 때 쓴다. 상태는 방의 모든 폰에 보이므로 비밀값 자체는 절대 싣지 않는다.
   * 보안 연결(https, localhost)이 아니면 만들 수 없어 null이다.
   */
  claimHash: string | null;
}

export interface ShotLog {
  turn: number;
  seat: Seat;
  angle: number;
  power: number;
  /** 제한 시간 안에 안 던져 원반 없이 넘어간 턴 */
  missed: boolean;
}

export interface LastShot {
  turn: number;
  seat: Seat;
  angle: number;
  power: number;
  /** 던지기 직전 보드. 화면은 이것과 각도·힘으로 같은 움직임을 다시 계산해 재생한다. */
  before: Puck[];
}

export interface MatchState {
  /** 경기마다 새로 정하는 id. 기록·로그인·설문을 이 경기에 묶는다. */
  matchId: string;
  /** 이 방에서 몇 번째 경기인가 */
  round: number;
  phase: MatchPhase;
  /** READY·FINISHED가 끝나는 시각(ms) */
  phaseEndsAt: number | null;
  seats: Record<Seat, SeatPlayer | null>;
  /** 지금 몇 번째 턴인가(0부터). 짝수는 A, 홀수는 B */
  turn: number;
  /** 지금 차례가 던져야 하는 마감 시각. 원반이 굴러가는 동안은 null */
  turnEndsAt: number | null;
  /** 원반이 멈추고 다음 차례로 넘어가는 시각. 굴러가는 중이 아니면 null */
  rollingUntil: number | null;
  pucks: Puck[];
  lastShot: LastShot | null;
  shots: ShotLog[];
  scores: Record<Seat, number>;
  winner: Seat | "DRAW" | null;
}

/** 폰 → TV */
export type MatchClientMessage =
  | { kind: "join"; playerId: string; name: string; claimHash: string | null }
  | { kind: "shoot"; playerId: string; turn: number; angle: number; power: number }
  | { kind: "leave"; playerId: string }
  /** 막 연결한 폰이 지금 상태를 달라고 한다. */
  | { kind: "hello"; playerId: string };

export type JoinRejection = "FULL" | "PLAYING";

/** TV → 폰 */
export type MatchHostMessage =
  | { kind: "state"; state: MatchState }
  | { kind: "rejected"; playerId: string; reason: JoinRejection };

export const TOTAL_TURNS = SHUFFLEBOARD_RULES.shotsPerSeat * SEATS.length;

export function initialMatch(round: number, matchId: string): MatchState {
  return {
    matchId,
    round,
    phase: "WAITING",
    phaseEndsAt: null,
    seats: { A: null, B: null },
    turn: 0,
    turnEndsAt: null,
    rollingUntil: null,
    pucks: [],
    lastShot: null,
    shots: [],
    scores: { A: 0, B: 0 },
    winner: null,
  };
}

export const seatOfTurn = (turn: number): Seat => SEATS[turn % SEATS.length];

export function seatOf(state: MatchState, playerId: string): Seat | null {
  return SEATS.find((seat) => state.seats[seat]?.playerId === playerId) ?? null;
}

/** 지금 던질 수 있는 자리. 경기 중이 아니거나 원반이 굴러가는 중이면 null */
export function shooterSeat(state: MatchState): Seat | null {
  if (state.phase !== "PLAYING" || state.rollingUntil !== null) return null;
  return seatOfTurn(state.turn);
}

/** 각 자리가 던진 횟수 (빈 턴 포함) */
export function shotsTaken(state: MatchState, seat: Seat): number {
  return state.shots.filter((shot) => shot.seat === seat).length;
}

/**
 * 랭킹에 보일 닉네임. 안 보이는 글자를 지우고 공백을 하나로 줄인 뒤 자른다. 비었거나
 * 공용 화면에 띄우면 안 되는 말이 있으면 팀 이름으로 부른다.
 */
export function normalizeName(name: string, seat: Seat): string {
  const cleaned = stripInvisible(name).replace(/\s+/g, " ").trim();
  const trimmed = cleaned.slice(0, SHUFFLEBOARD_RULES.nameMaxLength);
  if (!trimmed || hasBlockedWord(cleaned)) return `${seat}팀 참가자`;
  return trimmed;
}

export interface ApplyResult {
  state: MatchState;
  reply?: MatchHostMessage;
}

export function applyClientMessage(
  state: MatchState,
  message: MatchClientMessage,
  now: number,
): ApplyResult {
  switch (message.kind) {
    case "hello":
      return { state };

    case "join": {
      if (seatOf(state, message.playerId)) return { state };
      if (state.phase === "PLAYING" || state.phase === "FINISHED") {
        return {
          state,
          reply: { kind: "rejected", playerId: message.playerId, reason: "PLAYING" },
        };
      }
      // 먼저 온 사람이 A, 다음 사람이 B. 셋째는 받지 않는다. (명세 3장)
      const seat = SEATS.find((candidate) => state.seats[candidate] === null);
      if (!seat) {
        return {
          state,
          reply: { kind: "rejected", playerId: message.playerId, reason: "FULL" },
        };
      }
      const seats = {
        ...state.seats,
        [seat]: {
          playerId: message.playerId,
          name: normalizeName(message.name, seat),
          claimHash: message.claimHash,
        },
      };
      const full = SEATS.every((candidate) => seats[candidate] !== null);
      return {
        state: {
          ...state,
          seats,
          phase: full ? "READY" : "WAITING",
          phaseEndsAt: full ? now + SHUFFLEBOARD_RULES.startCountdownMs : null,
        },
      };
    }

    case "leave": {
      // 경기 중에 나가도 자리는 남긴다. 돌아오면 이어 하고, 안 오면 차례만 지나간다.
      if (state.phase === "PLAYING" || state.phase === "FINISHED") return { state };
      const seat = seatOf(state, message.playerId);
      if (!seat) return { state };
      return {
        state: {
          ...state,
          seats: { ...state.seats, [seat]: null },
          phase: "WAITING",
          phaseEndsAt: null,
        },
      };
    }

    case "shoot": {
      const shooter = shooterSeat(state);
      // 같은 발사가 두 번 오거나(재전송) 남의 차례에 보낸 발사는 버린다.
      if (
        !shooter ||
        message.turn !== state.turn ||
        seatOf(state, message.playerId) !== shooter
      ) {
        return { state };
      }
      const { angle, power } = clampShot(message.angle, message.power);
      const result = simulateShot(state.pucks, {
        puckId: `${shooter}${state.turn}`,
        seat: shooter,
        angle,
        power,
      });
      return {
        state: {
          ...state,
          turnEndsAt: null,
          rollingUntil: now + result.durationMs + SHUFFLEBOARD_RULES.settleMs,
          pucks: result.pucks,
          lastShot: { turn: state.turn, seat: shooter, angle, power, before: state.pucks },
          shots: [...state.shots, { turn: state.turn, seat: shooter, angle, power, missed: false }],
          scores: scorePucks(result.pucks),
        },
      };
    }
  }
}

function nextTurn(state: MatchState, at: number): MatchState {
  const turn = state.turn + 1;
  if (turn >= TOTAL_TURNS) {
    const { A, B } = state.scores;
    return {
      ...state,
      turn,
      phase: "FINISHED",
      phaseEndsAt: at + SHUFFLEBOARD_RULES.resultMs,
      turnEndsAt: null,
      rollingUntil: null,
      winner: A === B ? "DRAW" : A > B ? "A" : "B",
    };
  }
  return {
    ...state,
    turn,
    turnEndsAt: at + SHUFFLEBOARD_RULES.turnMs,
    rollingUntil: null,
  };
}

/**
 * 시간이 지나 상태가 바뀌었으면 다음 상태를, 아니면 같은 객체를 돌려준다.
 * 경기가 끝나 방을 비울 때 새 경기 id가 필요해 `nextMatchId`를 받는다.
 */
export function advanceMatch(
  state: MatchState,
  now: number,
  nextMatchId: () => string,
): MatchState {
  switch (state.phase) {
    case "WAITING":
      return state;
    case "READY":
      if (state.phaseEndsAt === null || now < state.phaseEndsAt) return state;
      return {
        ...state,
        phase: "PLAYING",
        phaseEndsAt: null,
        turn: 0,
        turnEndsAt: state.phaseEndsAt + SHUFFLEBOARD_RULES.turnMs,
      };
    case "PLAYING":
      if (state.rollingUntil !== null) {
        return now < state.rollingUntil ? state : nextTurn(state, state.rollingUntil);
      }
      if (state.turnEndsAt !== null && now >= state.turnEndsAt) {
        // 제한 시간 안에 안 던졌다. 원반 없이 0점으로 넘어간다.
        const seat = seatOfTurn(state.turn);
        return nextTurn(
          {
            ...state,
            shots: [...state.shots, { turn: state.turn, seat, angle: 0, power: 0, missed: true }],
          },
          state.turnEndsAt,
        );
      }
      return state;
    case "FINISHED":
      if (state.phaseEndsAt === null || now < state.phaseEndsAt) return state;
      return initialMatch(state.round + 1, nextMatchId());
  }
}

/** 남은 초(올림). 지금 재는 마감이 없으면 null */
export function secondsLeft(state: MatchState, now: number): number | null {
  const endsAt =
    state.phase === "PLAYING" ? state.turnEndsAt : state.phaseEndsAt;
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * 경기 결과. 서버에 "점수 임시 저장(pending_auth)"을 요청할 때 보내는 값이다.
 * (명세 7.1) 아직 서버가 없어 호출부(`onMatchFinished`)에 넘기기만 한다.
 */
export interface MatchResult {
  matchId: string;
  players: Array<{ seat: Seat; name: string; claimHash: string | null; score: number }>;
  winner: Seat | "DRAW";
  shots: ShotLog[];
}

export function matchResult(state: MatchState): MatchResult | null {
  if (state.phase !== "FINISHED" || state.winner === null) return null;
  return {
    matchId: state.matchId,
    players: SEATS.flatMap((seat) => {
      const player = state.seats[seat];
      return player
        ? [{ seat, name: player.name, claimHash: player.claimHash, score: state.scores[seat] }]
        : [];
    }),
    winner: state.winner,
    shots: state.shots,
  };
}
