import type { MatchResult } from "@/entities/game/model/shuffleboard";
import { shuffleboardApi } from "../api";

/**
 * 경기가 끝나면 TV가 결과를 서버에 보낸다(점수 임시 저장). 실패하면 몇 번 다시 보낸다.
 * 같은 경기를 여러 번 보내도 서버는 한 번만 저장한다.
 *
 * 폰은 이 기록이 서버에 있어야 로그인 뒤 "내 자리"를 증명할 수 있다.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];

export function reportMatch(result: MatchResult, roomId: string, deviceToken: string | null) {
  const send = (attempt: number) => {
    shuffleboardApi.reportMatch({ ...result, roomId }, deviceToken).catch(() => {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) window.setTimeout(() => send(attempt + 1), delay);
    });
  };
  send(0);
}
