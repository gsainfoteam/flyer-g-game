import { useEffect, useState } from "react";
import { EMPTY_RANKING, offlineRankingSource } from "../api/ranking-source";
import type { RankingSnapshot, RankingSource } from "../api/ranking-source";

/** TV는 오래 켜 두므로 랭킹을 주기적으로 다시 읽는다. */
const REFRESH_MS = 30_000;

export function useRanking(source: RankingSource = offlineRankingSource) {
  const [snapshot, setSnapshot] = useState<RankingSnapshot>(EMPTY_RANKING);

  useEffect(() => {
    let alive = true;
    const load = () =>
      source
        .load()
        .then((next) => {
          if (alive) setSnapshot(next);
        })
        // 랭킹을 못 읽어도 게임은 계속한다. 지난 값을 그대로 둔다.
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [source]);

  return { ...snapshot, live: source.live };
}
