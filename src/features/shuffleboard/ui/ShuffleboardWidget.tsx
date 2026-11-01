import { useEffect, useRef } from "react";
import { StageHeader } from "@/entities/poster/ui/StageHeader";
import { useShuffleboardHost } from "../model/use-shuffleboard-host";
import { joinUrlOf } from "../model/join-url";
import { ShuffleboardStageFor } from "./stage-helpers";

/**
 * 전단지 플레이어 순환 중에 뜨는 셔플보드 위젯.
 *
 * 클릭 배틀의 `BattleWidget`과 받는 값(props: pinned·survey 포함)과 내보내는 신호가 똑같다. 전단지의
 * `DisplayPage`에서 `<BattleWidget … />` 자리에 `<ShuffleboardWidget … />`를 넣으면
 * 게임 종류만 바뀐다.
 *
 * 화면에 뜨는 동안 이 TV의 게임 방을 연다. QR로 누가 참가하면 `onActiveChange(true)`로
 * 순환을 멈추게 하고, 방이 비면 `onSessionEnd`로 다음 화면으로 넘기게 한다.
 * 경기 중에는 끊지 않는다.
 */
const WIDGET_LIMITS = {
  lobbyWaitMs: 60_000,
  sessionLimitMs: 5 * 60_000,
} as const;

interface ShuffleboardWidgetProps {
  roomId: string;
  socketBase: string | null;
  token: string | null;
  deviceLabel: string | null;
  serverTime: Date | null;
  onActiveChange: (active: boolean) => void;
  onSessionEnd: () => void;
  /**
   * 행사 시간대처럼 이 화면에 고정된 때. 순환으로 돌려보낼 일이 없으니 세션 상한·상대 팀
   * 기다림으로 판을 비우지 않는다(기다리던 참가자가 쫓겨나지 않게). BattleWidget과 같다.
   */
  pinned?: boolean;
  /** 오른쪽 위 설문 QR. BattleWidget과 같은 값을 넘긴다. */
  survey?: { url: string; label: string } | null;
}

export function ShuffleboardWidget({
  roomId,
  socketBase,
  token,
  deviceLabel,
  serverTime,
  onActiveChange,
  onSessionEnd,
  pinned = false,
  survey = null,
}: ShuffleboardWidgetProps) {
  const { state, now, status, active } = useShuffleboardHost(roomId, {
    socketBase,
    token,
    ...(pinned ? {} : WIDGET_LIMITS),
  });

  // 콜백은 렌더마다 새로 올 수 있다. effect가 되풀이되지 않게 ref로 든다.
  const callbacks = useRef({ onActiveChange, onSessionEnd });
  useEffect(() => {
    callbacks.current = { onActiveChange, onSessionEnd };
  }, [onActiveChange, onSessionEnd]);

  const wasActive = useRef(false);
  useEffect(() => {
    callbacks.current.onActiveChange(active);
    if (wasActive.current && !active) callbacks.current.onSessionEnd();
    wasActive.current = active;
  }, [active]);

  // 화면을 떠나면 순환을 붙잡지 않는다.
  useEffect(() => () => callbacks.current.onActiveChange(false), []);

  return (
    <ShuffleboardStageFor
      state={state}
      now={now}
      link={status}
      local={socketBase === null}
      joinUrlOf={(seat) => joinUrlOf(roomId, seat)}
      survey={survey}
      header={
        <StageHeader deviceLabel={deviceLabel} serverTime={serverTime} clockTicking>
          <span className="text-[26px] font-extrabold text-ink-muted">셔플보드</span>
        </StageHeader>
      }
    />
  );
}
