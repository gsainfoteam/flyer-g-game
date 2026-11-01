import { createDemoServer } from "./demo-server";
import type { MatchReport } from "./contract";
import type { SurveyAnswers } from "@/entities/survey/model/questions";

const survey: SurveyAnswers = {
  answers: {
    board_viewed: "glanced",
    info_sources: ["ziggle"],
    wanted_info: ["events"],
    readability: "4",
    pain_points: ["none"],
    satisfaction: "5",
    revisit: "4",
  },
  others: {},
};

async function hash(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function report(matchId: string, roomId: string, a: number, b: number): Promise<MatchReport> {
  return {
    matchId,
    roomId,
    winner: a === b ? "DRAW" : a > b ? "A" : "B",
    shots: [],
    players: [
      { seat: "A", name: `${matchId}-A`, claimHash: await hash(`${matchId}-a`), score: a },
      { seat: "B", name: `${matchId}-B`, claimHash: await hash(`${matchId}-b`), score: b },
    ],
  };
}

describe("데모 서버 (백엔드와 같은 규칙)", () => {
  let user: string | null = null;
  const api = createDemoServer(() => user);
  beforeEach(() => {
    window.localStorage.clear();
    user = null;
  });

  it("경기 결과만으로는 랭킹에 오르지 않는다", async () => {
    await api.reportMatch(await report("m1", "old", 30, 20), null);
    expect((await api.ranking()).top).toEqual([]);
  });

  it("높은 점수를 낸 사람이 로그인하고 설문까지 내야 랭킹에 오른다", async () => {
    await api.reportMatch(await report("m1", "old", 30, 20), null);
    user = "winner";
    const claim = await api.claim("m1", "m1-a");
    expect(claim).toMatchObject({ seat: "A", recordHolder: true, surveySubmitted: false, ranked: false });
    expect((await api.ranking()).top).toEqual([]);
    await api.submitSurvey(survey);
    const ranking = await api.ranking();
    expect(ranking.top).toEqual([{ matchId: "m1", name: "m1-A", score: 30, venue: "old" }]);
    expect(ranking.venueBest).toEqual({ old: 30, new: null });
  });

  it("진 사람이 설문을 내도 그 경기는 오르지 않는다", async () => {
    await api.reportMatch(await report("m1", "old", 30, 20), null);
    user = "loser";
    expect((await api.claim("m1", "m1-b")).recordHolder).toBe(false);
    await api.submitSurvey(survey);
    expect((await api.ranking()).top).toEqual([]);
  });

  it("설문은 계정당 한 번이고, 다음 경기는 로그인만으로 오른다", async () => {
    user = "u1";
    await api.reportMatch(await report("m1", "old", 30, 20), null);
    await api.claim("m1", "m1-a");
    await api.submitSurvey(survey);
    await api.reportMatch(await report("m2", "new", 10, 40), null);
    const claim = await api.claim("m2", "m2-b");
    expect(claim.surveySubmitted).toBe(true);
    expect(claim.ranked).toBe(true);
    expect((await api.ranking()).top.map((e) => e.score)).toEqual([40, 30]);
  });

  it("1~3위까지만 보여 주고 높은 점수가 나오면 순위가 바뀐다", async () => {
    user = "u1";
    await api.submitSurvey(survey);
    for (const [id, score] of [["m1", 10], ["m2", 30], ["m3", 20], ["m4", 40]] as const) {
      await api.reportMatch(await report(id, "old", score, 0), null);
      await api.claim(id, `${id}-a`);
    }
    expect((await api.ranking()).top.map((e) => e.score)).toEqual([40, 30, 20]);
  });

  it("다른 계정이 가져간 자리, 한 계정이 두 자리를 가져가는 것은 막는다", async () => {
    await api.reportMatch(await report("m1", "old", 30, 20), null);
    user = "u1";
    await api.claim("m1", "m1-a");
    await expect(api.claim("m1", "m1-b")).rejects.toMatchObject({ code: "BOTH_SEATS" });
    user = "u2";
    await expect(api.claim("m1", "m1-a")).rejects.toMatchObject({ code: "CLAIMED_BY_OTHER" });
  });

  it("비밀값이 틀리면 자리를 가져갈 수 없다", async () => {
    await api.reportMatch(await report("m1", "old", 30, 20), null);
    user = "u1";
    await expect(api.claim("m1", "guess")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
