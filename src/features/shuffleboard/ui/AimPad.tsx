import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Seat } from "@/entities/game/model/shuffleboard";
import { PHYSICS } from "@/entities/game/model/shuffleboard-rules";
import { cn } from "@/shared/lib/utils";
import { SEAT_FILL } from "./seat-style";

/**
 * 새총 방식 조준. 원반을 아래로 당기면 반대쪽(위)으로 조준선이 나오고, 당긴 길이가
 * 힘이다. 손을 떼면 각도와 힘을 한 번 보낸다.
 *
 * 폰에는 보드를 보여 주지 않는다. 보드를 보면 거리를 눈으로 맞출 수 있어 너무 쉽다.
 * 플레이어는 TV를 보고 감으로 던진다. 그래서 이 패드가 폰 화면의 대부분을 차지한다.
 *
 * 조준은 이 폰 안에서만 그린다. TV로는 손을 뗀 결과만 간다. 그래서 0.8초 지연이
 * 조작감에 섞이지 않는다.
 */
/** 이보다 약하면 실수로 보고 던지지 않는다 */
const MIN_POWER = 0.05;
const PUCK_R = 44;

interface Aim {
  angle: number;
  power: number;
}

function aimOf(dx: number, dy: number, maxPull: number): Aim | null {
  // 아래(dy > 0)로 당겼을 때만 조준한다. 오른쪽으로 당기면 왼쪽(음수 각도)으로 간다.
  if (dy <= 0) return null;
  const degrees = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const angle = Math.max(-PHYSICS.maxAngleDeg, Math.min(PHYSICS.maxAngleDeg, degrees));
  const power = Math.min(1, Math.hypot(dx, dy) / maxPull);
  return { angle, power };
}

interface AimPadProps {
  seat: Seat;
  enabled: boolean;
  onShoot: (angle: number, power: number) => void;
  className?: string;
}

export function AimPad({ seat, enabled, onShoot, className }: AimPadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const [size, setSize] = useState({ width: 360, height: 480 });

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    const update = () => {
      const { width, height } = pad.getBoundingClientRect();
      if (width > 0 && height > 0) setSize({ width, height });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(pad);
    return () => observer.disconnect();
  }, []);

  // 원반은 가운데보다 조금 위에 둔다. 아래로 당길 공간과 위로 뻗을 조준선 공간을 같이 남긴다.
  const cx = size.width / 2;
  const cy = Math.round(size.height * 0.36);
  /** 이만큼(px) 당기면 힘 100%. 화면 아래 끝까지 손가락이 닿게 잡는다. */
  const maxPull = Math.max(120, Math.min(280, size.height - cy - PUCK_R - 40));

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setAim(null);
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.id !== event.pointerId) return;
    setAim(aimOf(event.clientX - start.x, event.clientY - start.y, maxPull));
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.id !== event.pointerId) return;
    startRef.current = null;
    const final = aimOf(event.clientX - start.x, event.clientY - start.y, maxPull);
    setAim(null);
    if (!enabled || !final || final.power < MIN_POWER) return;
    navigator.vibrate?.(20);
    onShoot(final.angle, final.power);
  };
  const onCancel = () => {
    startRef.current = null;
    setAim(null);
  };

  // 당긴 만큼 원반이 아래로 따라온다. 조준선은 반대쪽(위)으로 뻗는다.
  const radians = aim ? (aim.angle * Math.PI) / 180 : 0;
  const pull = aim ? aim.power * maxPull : 0;
  const puckX = cx - Math.sin(radians) * pull;
  const puckY = cy + Math.cos(radians) * pull;
  const reach = aim ? PUCK_R + 10 + aim.power * Math.max(0, cy - PUCK_R - 24) : 0;
  const tipX = cx + Math.sin(radians) * reach;
  const tipY = cy - Math.cos(radians) * reach;
  const fill = enabled ? SEAT_FILL[seat] : "var(--color-line-strong)";

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div
        ref={padRef}
        role="application"
        aria-label={enabled ? "원반을 아래로 당겼다 놓아 던지기" : "상대 차례"}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        className={cn(
          "relative min-h-[320px] flex-1 touch-none overflow-hidden rounded-card select-none",
          enabled ? "bg-surface" : "bg-surface-muted",
        )}
      >
        <svg width="100%" height="100%" aria-hidden="true" className="absolute inset-0">
          {aim && (
            <line
              x1={cx}
              y1={cy}
              x2={tipX}
              y2={tipY}
              stroke={fill}
              strokeWidth={10}
              strokeLinecap="round"
              strokeOpacity={0.5}
            />
          )}
          {/* 처음 자리 */}
          {aim && (
            <circle
              cx={cx}
              cy={cy}
              r={PUCK_R}
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth={2}
              strokeDasharray="6 6"
            />
          )}
          <circle cx={puckX} cy={puckY} r={PUCK_R} fill={fill} stroke="var(--color-surface)" strokeWidth={4} />
          <circle cx={puckX} cy={puckY} r={PUCK_R * 0.45} fill="var(--color-surface)" fillOpacity={0.3} />
        </svg>
        <p className="absolute inset-x-0 bottom-5 text-center text-body text-ink-muted">
          {enabled
            ? aim
              ? aim.power < MIN_POWER
                ? "조금 더 당겨요"
                : "놓으면 던져요"
              : "원반을 아래로 당겼다가 놓으세요"
            : "상대가 던지는 중이에요"}
        </p>
      </div>
      {/* 얼마나 세게 당겼는지만 보여 준다. 숫자는 일부러 보여 주지 않는다(감으로 던진다). */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="w-6 text-label text-ink-muted">힘</span>
        <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-muted">
          <div
            className="h-full rounded-pill"
            style={{ width: `${Math.round((aim?.power ?? 0) * 100)}%`, background: fill }}
          />
        </div>
      </div>
    </div>
  );
}
