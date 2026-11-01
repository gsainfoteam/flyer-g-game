import type { ReactNode } from "react";
import { Logo } from "@/shared/components/Logo";
import { LiveClock } from "@/shared/components/LiveClock";
import { STAGE_HEADER_HEIGHT } from "@/entities/poster/ui/stage-metrics";

/**
 * TV 화면 머리 줄. 모아 보기·크게 보기·흐르는 띠가 같은 자리를 써서 화면이
 * 바뀌어도 머리가 흔들리지 않는다. 오른쪽(`children`)은 화면마다 다르다.
 *
 * 머리 줄은 "여기가 어디인지"(로고·기기 이름·날짜)만 둔다. 시각·날씨처럼 자주 바뀌는
 * 것은 아래 정보줄(`StageInfoBar`)에 있다.
 */

interface StageHeaderProps {
  deviceLabel: string | null;
  serverTime: Date | null;
  clockTicking?: boolean;
  children?: ReactNode;
}

export function StageHeader({
  deviceLabel,
  serverTime,
  clockTicking = false,
  children,
}: StageHeaderProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-4"
      style={{ height: STAGE_HEADER_HEIGHT }}
    >
      <Logo size="lg" />
      {deviceLabel && (
        <span className="ml-2 text-[26px] text-ink-subtle">{deviceLabel}</span>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-7">
        {children}
        <LiveClock
          now={serverTime ?? undefined}
          ticking={clockTicking || serverTime === null}
          format="date"
          className="text-[30px]"
        />
      </div>
    </div>
  );
}
