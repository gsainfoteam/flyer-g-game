import {
  TOTAL_TURNS,
  advanceMatch,
  applyClientMessage,
  displayedScores,
  initialMatch,
  matchResult,
  normalizeName,
  seatOf,
  shooterSeat,
} from "./shuffleboard";
import type { MatchClientMessage, MatchState } from "./shuffleboard";
import { parseClientMessage } from "./shuffleboard-messages";
import { scorePucks, simulateShot, zonePoints } from "./shuffleboard-physics";
import { SHUFFLEBOARD_RULES } from "./shuffleboard-rules";

const ids = () => {
  let n = 0;
  return () => `match-${++n}`;
};

function apply(state: MatchState, message: MatchClientMessage, now = 0) {
  return applyClientMessage(state, message, now);
}

function join(state: MatchState, playerId: string, now = 0, seat: "A" | "B" | null = null) {
  return apply(state, { kind: "join", playerId, name: playerId, claimHash: null, seat }, now);
}

/** 두 명을 앉히고 카운트다운을 지나 경기를 시작한 상태 */
function started(): MatchState {
  let state = initialMatch(1, "m1");
  state = join(state, "p1").state;
  state = join(state, "p2").state;
  return advanceMatch(state, SHUFFLEBOARD_RULES.startCountdownMs, ids());
}

describe("입장", () => {
  it("한 명만 들어오면 시작하지 않는다", () => {
    const { state } = join(initialMatch(1, "m1"), "p1");
    expect(state.phase).toBe("WAITING");
    expect(state.seats.A?.playerId).toBe("p1");
    expect(advanceMatch(state, 60_000, ids())).toBe(state);
  });

  it("먼저 온 사람이 A, 다음 사람이 B이고 두 명이 모이면 3초 뒤 시작한다", () => {
    let state = join(initialMatch(1, "m1"), "p1", 100).state;
    state = join(state, "p2", 200).state;
    expect(state.seats.B?.playerId).toBe("p2");
    expect(state.phase).toBe("READY");
    expect(advanceMatch(state, 200 + SHUFFLEBOARD_RULES.startCountdownMs - 1, ids()).phase).toBe(
      "READY",
    );
    const playing = advanceMatch(state, 200 + SHUFFLEBOARD_RULES.startCountdownMs, ids());
    expect(playing.phase).toBe("PLAYING");
    expect(shooterSeat(playing)).toBe("A");
  });

  it("찍은 QR의 팀 자리에 앉는다", () => {
    let state = join(initialMatch(1, "m1"), "p1", 0, "B").state;
    expect(state.seats.B?.playerId).toBe("p1");
    expect(state.seats.A).toBeNull();
    const taken = join(state, "p2", 0, "B");
    expect(taken.state).toBe(state);
    expect(taken.reply).toEqual({ kind: "rejected", playerId: "p2", reason: "TAKEN" });
    state = join(state, "p2", 0, "A").state;
    expect(state.phase).toBe("READY");
  });

  it("세 번째 사람은 받지 않는다", () => {
    let state = join(initialMatch(1, "m1"), "p1").state;
    state = join(state, "p2").state;
    const third = join(state, "p3");
    expect(third.state).toBe(state);
    expect(third.reply).toEqual({ kind: "rejected", playerId: "p3", reason: "FULL" });
  });

  it("경기 중에는 입장을 받지 않는다", () => {
    const result = join(started(), "p3");
    expect(result.reply).toMatchObject({ reason: "PLAYING" });
  });

  it("카운트다운 중 한 명이 나가면 다시 기다린다", () => {
    let state = join(initialMatch(1, "m1"), "p1").state;
    state = join(state, "p2").state;
    state = apply(state, { kind: "leave", playerId: "p1" }).state;
    expect(state.phase).toBe("WAITING");
    expect(state.seats.A).toBeNull();
    // 빈 A 자리는 다음 사람이 채운다.
    state = join(state, "p3").state;
    expect(state.seats.A?.playerId).toBe("p3");
    expect(state.phase).toBe("READY");
  });

  it("경기 중에 나가도 자리를 지킨다", () => {
    const state = started();
    expect(apply(state, { kind: "leave", playerId: "p1" }).state).toBe(state);
  });

  it("닉네임을 정리하고 부적절하면 팀 이름으로 부른다", () => {
    expect(normalizeName("  하윤 ​ ", "A")).toBe("하윤");
    expect(normalizeName("", "B")).toBe("B팀 참가자");
    expect(normalizeName("가".repeat(30), "A")).toHaveLength(SHUFFLEBOARD_RULES.nameMaxLength);
  });
});

describe("차례", () => {
  it("A와 B가 번갈아 던진다", () => {
    let state = started();
    state = apply(state, { kind: "shoot", playerId: "p1", turn: 0, angle: 0, power: 0.8 }, 3_100)
      .state;
    expect(state.rollingUntil).not.toBeNull();
    expect(shooterSeat(state)).toBeNull();
    state = advanceMatch(state, state.rollingUntil!, ids());
    expect(state.turn).toBe(1);
    expect(shooterSeat(state)).toBe("B");
  });

  it("차례가 아닌 사람의 발사는 버린다", () => {
    const state = started();
    expect(
      apply(state, { kind: "shoot", playerId: "p2", turn: 0, angle: 0, power: 0.8 }).state,
    ).toBe(state);
  });

  it("같은 발사가 두 번 와도 한 번만 반영한다", () => {
    let state = started();
    const shot: MatchClientMessage = { kind: "shoot", playerId: "p1", turn: 0, angle: 0, power: 0.8 };
    state = apply(state, shot, 3_100).state;
    expect(apply(state, shot, 3_200).state).toBe(state);
    state = advanceMatch(state, state.rollingUntil!, ids());
    // 다음 턴에 지난 턴 번호로 다시 보내도 버린다.
    expect(apply(state, { ...shot, playerId: "p2" }).state).toBe(state);
  });

  it("원반이 굴러가는 동안에는 던지기 전 점수를 보여 준다", () => {
    let state = started();
    state = apply(state, { kind: "shoot", playerId: "p1", turn: 0, angle: 0, power: 0.85 }, 3_100)
      .state;
    expect(state.scores.A).toBe(10);
    expect(displayedScores(state).A).toBe(0);
    state = advanceMatch(state, state.rollingUntil!, ids());
    expect(displayedScores(state).A).toBe(10);
  });

  it("제한 시간 안에 안 던지면 0점으로 넘어간다", () => {
    let state = started();
    state = advanceMatch(state, state.turnEndsAt!, ids());
    expect(state.turn).toBe(1);
    expect(state.shots).toEqual([
      { turn: 0, seat: "A", angle: 0, power: 0, missed: true },
    ]);
    expect(state.pucks).toHaveLength(0);
  });

  it("정해진 횟수를 다 던지면 끝나고, 결과를 내고, 방을 비운다", () => {
    const next = ids();
    let state = started();
    let now: number = SHUFFLEBOARD_RULES.startCountdownMs;
    for (let turn = 0; turn < TOTAL_TURNS; turn++) {
      const playerId = turn % 2 === 0 ? "p1" : "p2";
      // A는 10점 근처, B는 약하게 던져 파울
      const power = playerId === "p1" ? 0.85 : 0.2;
      state = apply(state, { kind: "shoot", playerId, turn, angle: 0, power }, now).state;
      now = state.rollingUntil!;
      state = advanceMatch(state, now, next);
    }
    expect(state.phase).toBe("FINISHED");
    expect(state.winner).toBe("A");
    expect(state.shots).toHaveLength(TOTAL_TURNS);

    const result = matchResult(state);
    expect(result?.players.map((p) => p.seat)).toEqual(["A", "B"]);
    expect(result?.players[0].score).toBe(state.scores.A);

    const reset = advanceMatch(state, state.phaseEndsAt!, next);
    expect(reset.phase).toBe("WAITING");
    expect(reset.matchId).toBe("match-1");
    expect(reset.round).toBe(2);
    expect(seatOf(reset, "p1")).toBeNull();
  });
});

describe("물리와 점수", () => {
  it("힘에 따라 멈추는 구역이 정해지고, 너무 세면 떨어지고, 너무 약하면 치운다", () => {
    const at = (power: number) =>
      simulateShot([], { puckId: "x", seat: "A", angle: 0, power }).pucks[0];
    expect(at(0.2)).toBeUndefined();
    expect(zonePoints(at(0.6).y)).toBe(2);
    expect(zonePoints(at(0.85).y)).toBe(10);
    expect(at(1)).toBeUndefined();
  });

  it("상대 원반을 밀어내면 점수는 경기 끝 위치로 매긴다", () => {
    const first = simulateShot([], { puckId: "a", seat: "A", angle: 0, power: 0.8 });
    expect(scorePucks(first.pucks)).toEqual({ A: 7, B: 0 });
    const second = simulateShot(first.pucks, { puckId: "b", seat: "B", angle: 0, power: 0.95 });
    expect(second.removed).toContain("a");
    expect(scorePucks(second.pucks).A).toBe(0);
    expect(scorePucks(second.pucks).B).toBeGreaterThan(0);
  });

  it("같은 입력이면 항상 같은 결과다", () => {
    const shot = { puckId: "a", seat: "A" as const, angle: 7, power: 0.77 };
    expect(simulateShot([], shot)).toEqual(simulateShot([], shot));
  });

  it("각도와 힘의 범위를 넘는 값은 자른다", () => {
    const wild = simulateShot([], { puckId: "a", seat: "A", angle: 999, power: 0.8 });
    const max = simulateShot([], { puckId: "a", seat: "A", angle: 20, power: 0.8 });
    expect(wild).toEqual(max);
  });
});

describe("메시지 읽기", () => {
  it("모양이 틀린 메시지는 버린다", () => {
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage({ kind: "shoot", playerId: "p", turn: "0", angle: 0, power: 1 })).toBeNull();
    expect(parseClientMessage({ kind: "shoot", playerId: "p", turn: 0.5, angle: 0, power: 1 })).toBeNull();
    expect(parseClientMessage({ kind: "nope", playerId: "p" })).toBeNull();
  });

  it("해시 모양이 아닌 claimHash는 버린다", () => {
    expect(parseClientMessage({ kind: "join", playerId: "p", name: "a", claimHash: "secret" })).toEqual({
      kind: "join",
      playerId: "p",
      name: "a",
      claimHash: null,
      seat: null,
    });
  });
});
