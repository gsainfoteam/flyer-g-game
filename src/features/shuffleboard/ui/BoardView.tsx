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
  // 가장자리에 걸친 원반과 보드 테두리가 잘리지 않게 둘레를 둔다.
  const pad = BOARD.puckRadius + 1;
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
  /** 보드를 가로지르는 선 (y 위치) */
  const across = (y: number) => {
    if (y < from || y > to) return null;
    const a = place(0, y);
    const b = place(BOARD.width, y);
    return { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy };
  };

  const zones = BOARD.zones.map((zone, index) => ({
    ...zone,
    maxY: index === 0 ? BOARD.length : BOARD.zones[index - 1].minY,
  }));
  const surface = band(0, BOARD.length);
  const rail = band(-3, BOARD.length + 3);
  const foul = across(BOARD.foulLineY);
  const launch = place(BOARD.launch.x, BOARD.launch.y);
  // 토큰 이름을 문자열로 다 적어 둔다. Tailwind는 코드에 그대로 적힌 토큰만 CSS에 넣는다.
  const ZONE_FILL: Record<number, string> = {
    2: "var(--color-board-zone-2)",
    3: "var(--color-board-zone-3)",
    7: "var(--color-board-zone-7)",
    10: "var(--color-board-hot)",
  };
  const zoneFill = (points: number) => ZONE_FILL[points] ?? "var(--color-board-zone-2)";

  return (
    <svg
      role="img"
      aria-label="셔플보드 보드"
      viewBox={
        horizontal
          ? `${-pad} ${-pad} ${span + pad * 2} ${BOARD.width + pad * 2}`
          : `${-pad} ${-pad} ${BOARD.width + pad * 2} ${span + pad * 2}`
      }
      preserveAspectRatio="xMidYMid meet"
      className={cn("block", className)}
    >
      {/* 테두리(레일)와 판 */}
      {rail && (
        <rect
          {...(horizontal
            ? { ...rail, y: rail.y - 3, height: rail.height + 6 }
            : { ...rail, x: rail.x - 3, width: rail.width + 6 })}
          rx={3}
          fill="var(--color-board-rail)"
        />
      )}
      {surface && <rect {...surface} fill="var(--color-board-field)" />}

      {/* 점수 구역: 흰 선으로 나누고, 끝의 10점 칸은 초록 */}
      {zones.map((zone) => {
        const rect = band(zone.minY, zone.maxY);
        if (!rect) return null;
        // 원반이 지나는 가운데를 피해 위쪽(세로 보드는 왼쪽)에 쓴다.
        const mid = place(BOARD.width * 0.17, (zone.minY + zone.maxY) / 2);
        return (
          <g key={zone.points}>
            <rect {...rect} fill={zoneFill(zone.points)} />
            <text
              x={mid.cx}
              y={mid.cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={labelSize}
              fontWeight={800}
              fill="var(--color-board-line)"
              fillOpacity={0.75}
            >
              {zone.points}
            </text>
          </g>
        );
      })}
      {[...zones.map((zone) => zone.minY), BOARD.length].map((y) => {
        const line = across(y);
        return line ? (
          <line key={y} {...line} stroke="var(--color-board-line)" strokeOpacity={0.45} strokeWidth={0.8} />
        ) : null;
      })}

      {/* 파울 선: 이 선을 못 넘고 멈춘 원반은 치운다 */}
      {foul && (
        <line
          {...foul}
          stroke="var(--color-board-line)"
          strokeOpacity={0.3}
          strokeWidth={0.8}
          strokeDasharray="3 3"
        />
      )}
      {/* 발사 자리 */}
      {BOARD.launch.y >= from && BOARD.launch.y <= to && (
        <circle
          cx={launch.cx}
          cy={launch.cy}
          r={BOARD.puckRadius + 1.5}
          fill="none"
          stroke="var(--color-board-line)"
          strokeOpacity={0.4}
          strokeWidth={0.8}
        />
      )}

      {/* 원반: 팀 색 판에 흰 테두리, 가운데 손잡이 */}
      {shown.map((puck) => {
        const seat = seatOf.get(puck.id) ?? "A";
        const { cx, cy } = place(puck.x, puck.y);
        const r = BOARD.puckRadius;
        return (
          <g key={puck.id}>
            {puck.id === newest && (
              <circle cx={cx} cy={cy} r={r + 2} fill="var(--color-board-line)" fillOpacity={0.28} />
            )}
            <circle cx={cx} cy={cy} r={r} fill={SEAT_FILL[seat]} stroke="var(--color-board-line)" strokeWidth={1.1} />
            <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--color-board-line)" fillOpacity={0.3} />
          </g>
        );
      })}
    </svg>
  );
}
