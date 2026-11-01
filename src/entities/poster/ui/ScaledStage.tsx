import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import {
  TV_STAGE_HEIGHT,
  TV_STAGE_PADDING,
  TV_STAGE_WIDTH,
} from "@/entities/poster/ui/stage-metrics";

/**
 * 1920x1080 기준으로 그린 TV 화면을 담는 곳의 크기에 맞춰 통째로 축소·확대한다.
 *
 * TV 화면은 실측 px로 설계했다. 실제 기기의 CSS 뷰포트는 제각각이라(720p TV는
 * 1280x720, 4K TV는 DPR에 따라 3840x2160 또는 1920x1080) 고정 px 그대로 그리면
 * 작은 화면에서는 QR이 잘리고 큰 화면에서는 절반만 차지한다. 비율을 유지한 채
 * 가장 크게 맞추고, 남는 쪽은 스테이지 바탕색으로 채운다(letterbox).
 *
 * 게시 신청 미리보기도 같은 컴포넌트를 쓴다. 미리보기용 크기를 따로 잡으면 TV와
 * 달라진 잘림이 승인 뒤에야 드러난다. (명세 FR-SUB-03)
 */
interface ScaledStageProps {
  children: ReactNode;
  /** 바깥 상자. 크기는 부모가 정한다. */
  className?: string;
}

export function ScaledStage({ children, className }: ScaledStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const { width, height } = container.getBoundingClientRect();
      // 측정 전(0)에는 그리지 않는다. 0을 곱하면 화면이 사라진다.
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / TV_STAGE_WIDTH, height / TV_STAGE_HEIGHT));
    };

    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("tv-surface relative overflow-hidden text-ink", className)}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: TV_STAGE_WIDTH,
          height: TV_STAGE_HEIGHT,
          padding: TV_STAGE_PADDING,
          // 첫 측정은 그리기 전(layout effect)에 끝난다. 측정하지 못하는 환경에서는
          // 원래 크기로 그린다.
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
