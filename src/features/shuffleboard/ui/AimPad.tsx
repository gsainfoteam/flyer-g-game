import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Seat } from "@/entities/game/model/shuffleboard";
import { PHYSICS } from "@/entities/game/model/shuffleboard-rules";
import { cn } from "@/shared/lib/utils";
import { SEAT_FILL } from "./seat-style";

/**
 * 새총 방식 조준. 원반을 아래로 당기면 반대쪽(위)으로 조준선이 나오고, 당긴 길이가
 * 힘이다. 손을 떼면 각도와 힘을 한 번 보낸다.
 *
 * 조준은 이 폰 안에서만 그린다. TV로는 손을 뗀 결과만 간다. 그래서 0.8초 지연이
 * 조작감에 섞이지 않는다.
 */
/** 이만큼(px) 당기면 힘 100% */
const MAX_PULL = 180;
/** 이보다 약하면 실수로 보고 던지지 않는다 */
const MIN_POWER = 0.05;
const PAD_HEIGHT = 300;
const PUCK_R = 26;
/** 원반의 처음 자리. 아래로 당길 공간이 남도록 위쪽에 둔다. */
const REST_Y = 72;

interface Aim {
  angle: number;
  power: number;
}

function aimOf(dx: number, dy: number): Aim | null {
  // 아래(dy > 0)로 당겼을 때만 조준한다. 오른쪽으로 당기면 왼쪽(음수 각도)으로 간다.
  if (dy <= 0) return null;
  const degrees = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const angle = Math.max(-PHYSICS.maxAngleDeg, Math.min(PHYSICS.maxAngleDeg, degrees));
  const power = Math.min(1, Math.hypot(dx, dy) / MAX_PULL);
  return { angle, power };
}

interface AimPadProps {
  seat: Seat;
  enabled: boolean;
  onShoot: (angle: number, power: number) => void;
}

export function AimPad({ seat, enabled, onShoot }: AimPadProps) {
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const [width, setWidth] = useState(360);

  const measure = (element: HTMLDivElement | null) => {
    if (element) setWidth(element.getBoundingClientRect().width || 360);
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setAim(null);
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.id !== event.pointerId) return;
    setAim(aimOf(event.clientX - start.x, event.clientY - start.y));
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.id !== event.pointerId) return;
    startRef.current = null;
    const final = aimOf(event.clientX - start.x, event.clientY - start.y);
    setAim(null);
    if (!enabled || !final || final.power < MIN_POWER) return;
    navigator.vibrate?.(20);
    onShoot(final.angle, final.power);
  };
  const onCancel = () => {
    startRef.current = null;
    setAim(null);
  };

  const cx = width / 2;
  const cy = REST_Y;
  // 당긴 만큼 원반이 아래로 따라온다. 조준선은 반대쪽(위)으로 뻗는다.
  const radians = aim ? (aim.angle * Math.PI) / 180 : 0;
  const pull = aim ? aim.power * (PAD_HEIGHT - REST_Y - PUCK_R - 48) : 0;
  const puckX = cx - Math.sin(radians) * pull;
  const puckY = cy + Math.cos(radians) * pull;
  // 원반 가장자리에서 패드 위 끝 바로 앞까지
  const reach = aim ? PUCK_R + 8 + aim.power * (REST_Y - PUCK_R - 14) : 0;
  const tipX = cx + Math.sin(radians) * reach;
  const tipY = cy - Math.cos(radians) * reach;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={measure}
        role="application"
        aria-label={enabled ? "원반을 아래로 당겼다 놓아 던지기" : "상대 차례"}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        className={cn(
          "relative touch-none overflow-hidden rounded-card select-none",
          enabled ? "bg-surface" : "bg-surface-muted",
        )}
        style={{ height: PAD_HEIGHT }}
      >
        <svg width="100%" height={PAD_HEIGHT} aria-hidden="true">
          {aim && (
            <line
              x1={cx}
              y1={cy}
              x2={tipX}
              y2={tipY}
              stroke={SEAT_FILL[seat]}
              strokeWidth={8}
              strokeLinecap="round"
              strokeOpacity={0.55}
            />
          )}
          <circle
            cx={puckX}
            cy={puckY}
            r={PUCK_R}
            fill={enabled ? SEAT_FILL[seat] : "var(--color-line-strong)"}
          />
        </svg>
        <p className="absolute inset-x-0 bottom-4 text-center text-label text-ink-muted">
          {enabled
            ? aim
              ? aim.power < MIN_POWER
                ? "조금 더 당겨요"
                : "놓으면 던져요"
              : "원반을 아래로 당겼다가 놓으세요"
            : "상대가 던지는 중이에요"}
        </p>
      </div>
      <div className="flex items-center gap-3" aria-live="polite">
        <span className="w-10 text-label text-ink-muted">힘</span>
        <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-muted">
          <div
            className="h-full rounded-pill"
            style={{ width: `${Math.round((aim?.power ?? 0) * 100)}%`, background: SEAT_FILL[seat] }}
          />
        </div>
        <span className="w-12 text-right text-label text-ink tabular-nums">
          {Math.round((aim?.power ?? 0) * 100)}%
        </span>
      </div>
    </div>
  );
}
