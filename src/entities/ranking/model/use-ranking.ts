import { useEffect, useState } from "react";
import { EMPTY_RANKING } from "@/entities/game/api/contract";
import type { RankingSnapshot } from "@/entities/game/api/contract";

/**
 * 랭킹을 주기적으로 읽는다. TV는 오래 켜 두고, 새 기록은 누군가 설문을 낼 때 생긴다.
 *
 * 랭킹에는 "경기의 높은 점수를 낸 사람이 로그인하고 설문까지 낸" 경기만 들어간다.
 * 그 확인은 서버가 한다. 읽기에 실패하면 지난 값을 그대로 둔다.
 */
const REFRESH_MS = 15_000;

export function useRanking(load: () => Promise<RankingSnapshot>, refreshMs = REFRESH_MS) {
  const [snapshot, setSnapshot] = useState<RankingSnapshot>(EMPTY_RANKING);

  useEffect(() => {
    let alive = true;
    const read = () =>
      load()
        .then((next) => {
          if (alive) setSnapshot(next);
        })
        .catch(() => {});
    void read();
    const timer = window.setInterval(read, refreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [load, refreshMs]);

  return snapshot;
}
