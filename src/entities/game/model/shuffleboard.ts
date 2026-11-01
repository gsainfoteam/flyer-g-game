import { clampShot, scorePucks, simulateShot } from "./shuffleboard-physics";
import type { Puck } from "./shuffleboard-physics";
import { SEATS, SHUFFLEBOARD_RULES } from "./shuffleboard-rules";
import type { Seat } from "./shuffleboard-rules";

/**
 * 셔플보드 1:1 경기. A팀과 B팀이 번갈아 원반을 던진다. 로그인·닉네임 없이 참가한다.
 *
 * TV마다 QR이 팀별로 두 개(A팀 QR, B팀 QR)다. 찍은 QR의 팀 자리에 앉는다.
 *
 * TV가 심판이다(클릭 배틀과 같다). 폰은 "각도와 힘"만 보내고, 차례 확인·물리·점수·
 * 시간은 모두 TV가 한다. 폰이 보낸 점수는 받지 않는다. (명세 6장)
 *
 * 흐름: WAITING(0~1명, QR) → READY(2명, 3초 카운트다운) → PLAYING(번갈아 던짐)
 * → FINISHED(결과) → 방을 비우고 새 경기로 WAITING. 설문은 TV 오른쪽 위 QR(노션폼)로
 * 따로 받으므로 방은 바로 다음 참가자를 받는다.
 *
 * 이 파일은 시간과 전송을 모르는 순수 함수다. 시각과 새 경기 id는 호출부가 넘긴다.
 */
export { SEATS };
export type { Seat };

export type MatchPhase = "WAITING" | "READY" | "PLAYING" | "FINISHED";

export interface SeatPlayer {
  playerId: string;
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
  /** 경기마다 새로 정하는 id. 폰이 끝난 경기의 결과를 가려 보관할 때 쓴다. */
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
  | {
      kind: "join";
      playerId: string;
      /** 찍은 QR의 팀. 없으면 빈 자리 아무 데나(A 먼저) 앉는다. */
      seat: Seat | null;
    }
  | { kind: "shoot"; playerId: string; turn: number; angle: number; power: number }
  | { kind: "leave"; playerId: string }
  /** 막 연결한 폰이 지금 상태를 달라고 한다. */
  | { kind: "hello"; playerId: string };

/** FULL: 두 자리가 다 찼다. TAKEN: 고른 팀 자리에 이미 누가 있다. PLAYING: 경기 중이다. */
export type JoinRejection = "FULL" | "TAKEN" | "PLAYING";

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
      // 찍은 QR의 팀 자리에 앉는다. 팀이 없으면 빈 자리(A 먼저). 셋째는 받지 않는다.
      const free = SEATS.filter((candidate) => state.seats[candidate] === null);
      if (free.length === 0) {
        return {
          state,
          reply: { kind: "rejected", playerId: message.playerId, reason: "FULL" },
        };
      }
      if (message.seat && state.seats[message.seat] !== null) {
        return {
          state,
          reply: { kind: "rejected", playerId: message.playerId, reason: "TAKEN" },
        };
      }
      const seat = message.seat ?? free[0];
      const seats = {
        ...state.seats,
        [seat]: { playerId: message.playerId },
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

/**
 * 화면에 보일 점수. 원반이 굴러가는 동안에는 던지기 전 점수를 보여 준다. 심판은 이미
 * 결과를 알지만, 원반이 멈추기 전에 점수가 먼저 바뀌면 결과를 미리 알려 주는 셈이다.
 */
export function displayedScores(state: MatchState): Record<Seat, number> {
  if (state.rollingUntil !== null && state.lastShot) return scorePucks(state.lastShot.before);
  return state.scores;
}

/** 남은 초(올림). 지금 재는 마감이 없으면 null */
export function secondsLeft(state: MatchState, now: number): number | null {
  const endsAt =
    state.phase === "PLAYING" ? state.turnEndsAt : state.phaseEndsAt;
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
