import type { ComponentProps } from "react";
import { SEATS } from "@/entities/game/model/shuffleboard";
import type { Seat } from "@/entities/game/model/shuffleboard";
import { cn } from "@/shared/lib/utils";
import type { GameLinkStatus } from "@/shared/lib/ws-game-channel";
import { ShuffleboardStage } from "./ShuffleboardStage";

type StageProps = ComponentProps<typeof ShuffleboardStage>;

/**
 * 연결 상태에 따라 QR을 보여 줄지 정해 `ShuffleboardStage`에 넘긴다.
 * 서버 중계는 방이 열려야(TV 인증) QR을 보여 준다. 그전에 찍으면 붙을 곳이 없다.
 */
export function ShuffleboardStageFor({
  link,
  local,
  joinUrlOf,
  ...rest
}: Omit<StageProps, "joinUrls" | "closedLabel"> & {
  link: GameLinkStatus | null;
  local: boolean;
  /** 팀별 QR 주소를 만든다 */
  joinUrlOf: (seat: Seat) => string;
}) {
  const ready = local || link === "open";
  const joinable = rest.state.phase === "WAITING";
  return (
    <ShuffleboardStage
      {...rest}
      joinUrls={
        Object.fromEntries(
          SEATS.map((seat) => [seat, ready && joinable ? joinUrlOf(seat) : null]),
        ) as Record<Seat, string | null>
      }
      closedLabel={
        !joinable
          ? "두 명이 모였어요\n곧 시작해요"
          : link === "unauthorized"
            ? "이 TV는 게임을 열 수 없어요\n기기 설정 링크로 다시 열어 주세요"
            : link === "replaced"
              ? "다른 화면에서\n이 TV의 게임을 열었어요"
              : "연결 준비 중이에요"
      }
    />
  );
}

const LINK_LABEL: Record<GameLinkStatus, { text: string; dot: string }> = {
  connecting: { text: "서버 연결 중", dot: "bg-warning" },
  reconnecting: { text: "다시 연결 중", dot: "bg-warning" },
  open: { text: "폰 연결 가능", dot: "bg-success" },
  "waiting-host": { text: "서버 연결 중", dot: "bg-warning" },
  unauthorized: { text: "기기 인증 실패", dot: "bg-danger" },
  replaced: { text: "다른 화면에서 열림", dot: "bg-danger" },
};

export function LinkBadge({ local, status }: { local: boolean; status: GameLinkStatus | null }) {
  if (local) return <span className="text-[22px] text-ink-subtle">같은 브라우저 전용</span>;
  const { text, dot } = LINK_LABEL[status ?? "connecting"];
  return (
    <span className="flex items-center gap-2 text-[22px] text-ink-subtle">
      <span aria-hidden="true" className={cn("size-3 rounded-pill", dot)} />
      {text}
    </span>
  );
}
