import { useCallback, useEffect, useState } from "react";
import { ShuffleboardApiError } from "@/entities/game/api/contract";
import type {
  ClaimResult,
  RankingSnapshot,
  ShuffleboardErrorCode,
} from "@/entities/game/api/contract";
import type { SurveyAnswers } from "@/entities/survey/model/questions";
import { playerAuth, shuffleboardApi } from "../api";
import type { FinishedMatch } from "./use-shuffleboard-player";

/**
 * 경기 뒤 폰의 흐름: 로그인 → (처음이면) 설문 → 랭킹 확인.
 *
 * 로그인하면 바로 "이 자리는 내 것"을 서버에 증명한다(claim). 그 계정이 설문을 이미
 * 냈으면 설문을 띄우지 않는다(계정당 한 번). 로그인으로 화면을 떠났다 돌아와도
 * 끝난 경기 정보는 이 탭에 남아 있어 이어서 진행한다.
 */
export type AfterMatchStep =
  | { kind: "signin" }
  | { kind: "working"; label: string }
  | { kind: "survey"; claim: ClaimResult }
  | { kind: "done"; claim: ClaimResult; ranking: RankingSnapshot | null; surveyJustSubmitted: boolean }
  | { kind: "error"; code: ShuffleboardErrorCode | "NO_SECRET" };

/** TV가 결과를 보내는 중일 수 있어 기록이 없으면 잠깐 기다렸다 다시 묻는다. */
const NOT_FOUND_RETRIES = [1_500, 3_000, 6_000];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function claimWithRetry(matchId: string, secret: string): Promise<ClaimResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await shuffleboardApi.claim(matchId, secret);
    } catch (error) {
      const delay = NOT_FOUND_RETRIES[attempt];
      if (error instanceof ShuffleboardApiError && error.code === "NOT_FOUND" && delay !== undefined) {
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
}

const codeOf = (error: unknown): ShuffleboardErrorCode =>
  error instanceof ShuffleboardApiError ? error.code : "NETWORK";

async function doneStep(claim: ClaimResult, surveyJustSubmitted: boolean): Promise<AfterMatchStep> {
  const ranking = await shuffleboardApi.ranking().catch(() => null);
  return { kind: "done", claim, ranking, surveyJustSubmitted };
}

export function useAfterMatch(finished: FinishedMatch) {
  const [signedIn, setSignedIn] = useState(() => playerAuth.isSignedIn());
  /** 늘리면 기록 확인을 다시 한다(다시 시도). */
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<AfterMatchStep>(() =>
    signedIn ? { kind: "working", label: "기록을 확인하고 있어요" } : { kind: "signin" },
  );

  // 로그인돼 있으면(처음부터, 로그인에서 돌아와서, 다시 시도) 내 자리를 확인한다.
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const run = async () => {
      if (!finished.claimSecret) {
        setStep({ kind: "error", code: "NO_SECRET" });
        return;
      }
      setStep({ kind: "working", label: "기록을 확인하고 있어요" });
      try {
        const claim = await claimWithRetry(finished.matchId, finished.claimSecret);
        const next: AfterMatchStep = claim.surveySubmitted
          ? await doneStep(claim, false)
          : { kind: "survey", claim };
        if (alive) setStep(next);
      } catch (error) {
        if (alive) setStep({ kind: "error", code: codeOf(error) });
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [signedIn, attempt, finished.claimSecret, finished.matchId]);

  const signIn = useCallback(async () => {
    await playerAuth.signIn(window.location.pathname + window.location.search);
    // 데모 로그인은 화면을 떠나지 않는다. 실제 로그인은 돌아오면 첫 렌더에서 이어 간다.
    setSignedIn(playerAuth.isSignedIn());
  }, []);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  const submitSurvey = useCallback(
    async (answers: SurveyAnswers) => {
      setStep({ kind: "working", label: "설문을 보내고 있어요" });
      try {
        await shuffleboardApi.submitSurvey(answers);
        // 설문을 내면 이 경기가 랭킹에 들어갔는지 다시 묻는다.
        const claim = await shuffleboardApi.claim(finished.matchId, finished.claimSecret ?? "");
        setStep(await doneStep(claim, true));
      } catch (error) {
        setStep({ kind: "error", code: codeOf(error) });
      }
    },
    [finished.claimSecret, finished.matchId],
  );

  return { step, signIn, retry, submitSurvey, demo: playerAuth.demo || shuffleboardApi.demo };
}
