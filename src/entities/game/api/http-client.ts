import type { SurveyAnswers } from "@/entities/survey/model/questions";
import { ShuffleboardApiError } from "./contract";
import type { ClaimResult, MatchReport, RankingSnapshot, ShuffleboardApi } from "./contract";

/**
 * 실제 서버(전단지 백엔드의 shuffleboard 모듈)에 붙는 클라이언트.
 *
 * 전단지 FE로 옮기면 `getAccessToken`에 전단지 로그인(`features/auth`)의 토큰을 넘긴다.
 * TV는 기기 토큰(`X-Device-Token`)으로, 폰은 로그인 토큰(`Authorization: Bearer`)으로 부른다.
 */
const ERROR_BY_STATUS: Record<number, ShuffleboardApiError["code"]> = {
  401: "UNAUTHENTICATED",
  404: "NOT_FOUND",
  422: "INVALID",
};

export function createHttpShuffleboardApi(
  baseUrl: string,
  getAccessToken: () => Promise<string | null>,
): ShuffleboardApi {
  async function call<T>(path: string, init: RequestInit & { auth?: "user" | "none" } = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (init.auth === "user") {
      const token = await getAccessToken();
      if (!token) throw new ShuffleboardApiError("UNAUTHENTICATED");
      headers.set("Authorization", `Bearer ${token}`);
    }
    let response: Response;
    try {
      response = await fetch(new URL(path, baseUrl), { ...init, headers });
    } catch {
      throw new ShuffleboardApiError("NETWORK");
    }
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      throw new ShuffleboardApiError(
        body?.code === "SHUFFLEBOARD_BOTH_SEATS" ? "BOTH_SEATS" : "CLAIMED_BY_OTHER",
      );
    }
    if (!response.ok) {
      throw new ShuffleboardApiError(ERROR_BY_STATUS[response.status] ?? "NETWORK");
    }
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  return {
    demo: false,
    reportMatch: (report: MatchReport, deviceToken: string | null) =>
      call("/shuffleboard/matches", {
        method: "POST",
        headers: deviceToken ? { "X-Device-Token": deviceToken } : {},
        body: JSON.stringify(report),
      }),
    claim: (matchId: string, claimSecret: string) =>
      call<ClaimResult>("/shuffleboard/claims", {
        method: "POST",
        auth: "user",
        body: JSON.stringify({ matchId, claimSecret }),
      }),
    surveyStatus: () => call<{ submitted: boolean }>("/shuffleboard/survey/me", { auth: "user" }),
    submitSurvey: (answers: SurveyAnswers) =>
      call("/shuffleboard/survey", { method: "POST", auth: "user", body: JSON.stringify(answers) }),
    ranking: () => call<RankingSnapshot>("/shuffleboard/ranking"),
  };
}
