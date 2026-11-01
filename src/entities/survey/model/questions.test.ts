import { SURVEY_QUESTIONS, toggleChoice, validateSurvey } from "./questions";
import type { SurveyAnswers } from "./questions";

/** 1~7번을 모두 고른 최소 응답 */
export function minimalAnswers(): SurveyAnswers {
  return {
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
}

describe("설문 검증", () => {
  it("문항은 9개이고 8·9번만 주관식(선택)이다", () => {
    expect(SURVEY_QUESTIONS).toHaveLength(9);
    expect(SURVEY_QUESTIONS.filter((q) => q.kind === "text").map((q) => q.id)).toEqual([
      "improve_first",
      "new_features",
    ]);
  });

  it("1~7번만 고르고 8·9번을 비워도 낼 수 있다", () => {
    expect(validateSurvey(minimalAnswers())).toEqual([]);
  });

  it("고르지 않은 필수 문항을 알려 준다", () => {
    const input = minimalAnswers();
    delete input.answers.readability;
    input.answers.info_sources = [];
    expect(validateSurvey(input).map((p) => p.questionId)).toEqual(["info_sources", "readability"]);
  });

  it("없는 선택지와 너무 긴 글은 받지 않는다", () => {
    const input = minimalAnswers();
    input.answers.board_viewed = "hacked";
    input.answers.improve_first = "가".repeat(1_001);
    expect(validateSurvey(input).map((p) => p.questionId)).toEqual(["board_viewed", "improve_first"]);
  });

  it("'불편한 부분이 없었다'는 다른 것과 함께 고를 수 없다", () => {
    const input = minimalAnswers();
    input.answers.pain_points = ["none", "too_fast"];
    expect(validateSurvey(input)).toHaveLength(1);
  });

  it("배타 선택지를 누르면 혼자 남고, 다른 걸 누르면 빠진다", () => {
    const question = SURVEY_QUESTIONS.find((q) => q.id === "pain_points");
    if (question?.kind !== "multi") throw new Error("pain_points must be multi");
    expect(toggleChoice(question, ["too_fast", "complex"], "none")).toEqual(["none"]);
    expect(toggleChoice(question, ["none"], "too_fast")).toEqual(["too_fast"]);
    expect(toggleChoice(question, ["too_fast"], "too_fast")).toEqual([]);
  });
});
