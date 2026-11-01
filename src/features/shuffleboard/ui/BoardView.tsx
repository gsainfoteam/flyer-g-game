import { useEffect, useMemo, useRef, useState } from "react";
import { simulateShot } from "@/entities/game/model/shuffleboard-physics";
import type { Puck, PuckFrame } from "@/entities/game/model/shuffleboard-physics";
import type { LastShot, Seat } from "@/entities/game/model/shuffleboard";
import { BOARD } from "@/entities/game/model/shuffleboard-rules";
import { cn } from "@/shared/lib/utils";
import { SEAT_FILL } from "./seat-style";

/**
 * 셔플보드 보드 그림. TV(가로)와 폰(세로)이 같이 쓴다.
 *
 * 방금 던진 원반은 심판과 같은 물리 함수로 움직임을 다시 계산해 재생한다. 그래서
 * 화면에서 멈춘 자리와 점수를 매긴 자리가 같다. 재생이 끝나면 상태의 원반을 그린다.
 *
 * 꾸밈 선 없이 면의 밝기 차이로 구역을 나눈다. 색은 전단지 토큰만 쓴다.
 */

interface BoardViewProps {
  pucks: readonly Puck[];
  lastShot: LastShot | null;
  /** 원반이 굴러가는 중인가. 이때만 재생한다(새로고침한 화면이 지난 발사를 다시 틀지 않게). */
  rolling: boolean;
  /** 같은 경기의 같은 턴인지 가리는 값 */
  matchId: string;
  orientation: "horizontal" | "vertical";
  /** 보드의 어느 구간을 보여 줄지 (보드 단위 y) */
  from?: number;
  to?: number;
  /** 구역 점수 글자 크기 (보드 단위) */
  labelSize?: number;
  className?: string;
}

function useReplay(
  lastShot: LastShot | null,
  rolling: boolean,
  matchId: string,
): PuckFrame | null {
  const key = lastShot ? `${matchId}:${lastShot.turn}` : null;
  const replay = useMemo(() => {
    if (!lastShot) return null;
    return simulateShot(lastShot.before, {
      puckId: `${lastShot.seat}${lastShot.turn}`,
      seat: lastShot.seat,
      angle: lastShot.angle,
      power: lastShot.power,
    });
    // 같은 턴이면 같은 결과다. 상태가 새 객체로 와도 다시 계산하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [frame, setFrame] = useState<PuckFrame | null>(null);
  const playedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!replay || !key || !rolling || playedRef.current === key) return;
    playedRef.current = key;
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const index = Math.floor((performance.now() - startedAt) / replay.frameMs);
      if (index >= replay.frames.length - 1) {
        setFrame(null);
        return;
      }
      setFrame(replay.frames[index]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setFrame(null);
    };
  }, [replay, key, rolling]);

  return frame;
}

export function BoardView({
  pucks,
  lastShot,
  rolling,
  matchId,
  orientation,
  from = 0,
  to = BOARD.length + 12,
  labelSize = 14,
  className,
}: BoardViewProps) {
  const frame = useReplay(lastShot, rolling, matchId);
  const seatOf = useMemo(() => {
    const map = new Map<string, Seat>();
    for (const puck of [...(lastShot?.before ?? []), ...pucks]) map.set(puck.id, puck.seat);
    if (lastShot) map.set(`${lastShot.seat}${lastShot.turn}`, lastShot.seat);
    return map;
  }, [lastShot, pucks]);
  const shown = frame ?? pucks;
  const newest = lastShot ? `${lastShot.seat}${lastShot.turn}` : null;

  const span = to - from;
  const pad = BOARD.puckRadius;
  const horizontal = orientation === "horizontal";
  // 보드 좌표(x: 폭, y: 길이) → 그림 좌표. 가로는 왼쪽에서 던지고, 세로는 아래에서 던진다.
  const place = (x: number, y: number) =>
    horizontal ? { cx: y - from, cy: x } : { cx: x, cy: to - y };
  const band = (y0: number, y1: number) => {
    const lo = Math.max(y0, from);
    const hi = Math.min(y1, to);
    if (hi <= lo) return null;
    return horizontal
      ? { x: lo - from, y: 0, width: hi - lo, height: BOARD.width }
      : { x: 0, y: to - hi, width: BOARD.width, height: hi - lo };
  };

  const zones = BOARD.zones.map((zone, index) => ({
    ...zone,
    maxY: index === 0 ? BOARD.length : BOARD.zones[index - 1].minY,
  }));
  const surface = band(0, BOARD.length);
  const foul = band(BOARD.foulLineY - 1, BOARD.foulLineY + 1);

  return (
    <svg
      role="img"
      aria-label="셔플보드 보드"
      // 가장자리에 걸친 원반이 잘리지 않게 원반 반지름만큼 둘레를 둔다.
      viewBox={
        horizontal
          ? `${-pad} ${-pad} ${span + pad * 2} ${BOARD.width + pad * 2}`
          : `${-pad} ${-pad} ${BOARD.width + pad * 2} ${span + pad * 2}`
      }
      preserveAspectRatio="xMidYMid meet"
      className={cn("block", className)}
    >
      {surface && <rect {...surface} fill="var(--color-surface-muted)" />}
      {zones.map((zone, index) => {
        const rect = band(zone.minY, zone.maxY);
        if (!rect) return null;
        // 원반이 지나는 가운데를 피해 가장자리 쪽에 쓴다.
        const mid = place(BOARD.width * 0.12, (zone.minY + zone.maxY) / 2);
        // 점수가 높을수록 밝다. 가장자리 10점이 가장 눈에 띈다.
        const opacity = [0.3, 0.2, 0.13, 0.07][index] ?? 0.07;
        return (
          <g key={zone.points}>
            <rect {...rect} fill="var(--color-ink)" fillOpacity={opacity} />
            <text
              x={mid.cx}
              y={mid.cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={labelSize}
              fontWeight={800}
              fill="var(--color-ink)"
              fillOpacity={0.55}
            >
              {zone.points}
            </text>
          </g>
        );
      })}
      {foul && <rect {...foul} fill="var(--color-ink)" fillOpacity={0.18} />}
      {shown.map((puck) => {
        const seat = seatOf.get(puck.id) ?? "A";
        const { cx, cy } = place(puck.x, puck.y);
        return (
          <circle
            key={puck.id}
            cx={cx}
            cy={cy}
            r={BOARD.puckRadius}
            fill={SEAT_FILL[seat]}
            stroke="var(--color-canvas)"
            strokeWidth={puck.id === newest ? 1.6 : 0.8}
          />
        );
      })}
    </svg>
  );
}
