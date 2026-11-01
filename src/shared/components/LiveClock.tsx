import { useEffect, useState } from "react";
import { getSeoulParts } from "@/shared/lib/datetime";
import { cn } from "@/shared/lib/utils";

/**
 * TV 화면의 현재 시각. 표시는 항상 Asia/Seoul 기준이다. (명세 6.3)
 * 기기의 시간대 설정과 무관하게 같은 시각을 보여준다.
 *
 * `now`(서버 시각)를 넘기면 그 값을 기준으로 삼는다. `ticking`이면 기준 시각에서
 * 흐른 시간만큼 전진시켜 표시한다 — 기기 시계가 틀려도 서버 기준으로 흐르는
 * 시계가 된다. 편성 갱신마다 새 서버 시각으로 다시 맞춰진다.
 */
const pad = (value: number) => String(value).padStart(2, "0");

interface LiveClockProps {
  /** 기준 시각. 없으면 기기 시계를 쓴다. */
  now?: Date;
  /** true면 기준 시각에서 흐른 시간만큼 전진한다. 미리보기·테스트는 고정이 기본. */
  ticking?: boolean;
  className?: string;
}

export function LiveClock({ now, ticking = false, className }: LiveClockProps) {
  const [tick, setTick] = useState(() => now ?? new Date());

  useEffect(() => {
    if (now && !ticking) return;
    const baseServer = now?.getTime();
    const baseClient = Date.now();
    const update = () =>
      setTick(
        baseServer === undefined
          ? new Date()
          : new Date(baseServer + (Date.now() - baseClient)),
      );
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [now, ticking]);

  const current = now && !ticking ? now : tick;
  const { year, month, day, weekday, hour24, minute } = getSeoulParts(current);

  return (
    <p className={cn("tabular-nums text-ink-subtle", className)}>
      {year}. {pad(month)}. {pad(day)}. ({weekday}) {pad(hour24)}:{pad(minute)}
    </p>
  );
}
