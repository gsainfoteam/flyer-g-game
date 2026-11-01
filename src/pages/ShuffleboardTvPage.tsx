import { useMemo } from "react";
import { useLocation, useParams } from "react-router";
import { ScaledStage } from "@/entities/poster/ui/ScaledStage";
import { gameSocketBase } from "@/features/shuffleboard/api/game-socket";
import { useShuffleboardHost } from "@/features/shuffleboard/model/use-shuffleboard-host";
import { joinUrlOf } from "@/features/shuffleboard/model/join-url";
import { LinkBadge, ShuffleboardStageFor } from "@/features/shuffleboard/ui/stage-helpers";
import { useRanking } from "@/entities/ranking/model/use-ranking";
import { loadRanking, shuffleboardApi } from "@/features/shuffleboard/api";
import { reportMatch } from "@/features/shuffleboard/model/report-match";
import { Logo } from "@/shared/components/Logo";
import { VENUE_LABEL, venueOfRoom } from "@/shared/config/venue";
import {
  captureDeviceTokenFromUrl,
  deviceCredentials,
} from "@/shared/lib/device-credential";

/**
 * 셔플보드 단독 TV 화면. 이 TV가 경기의 심판이다(`useShuffleboardHost`).
 * 클릭 배틀의 `ClickBattleTvPage`와 같은 모양이다.
 */
export function ShuffleboardTvPage() {
  const { roomId = "old" } = useParams();
  const { hash } = useLocation();
  const token = useMemo(() => {
    captureDeviceTokenFromUrl(roomId);
    return deviceCredentials.get(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hash가 바뀌면 설정 링크를 다시 읽는다
  }, [roomId, hash]);
  const socketBase = gameSocketBase();
  const { state, now, status: link } = useShuffleboardHost(roomId, {
    socketBase,
    token,
    // 두 사람의 점수를 서버에 임시 저장한다. 아직 랭킹은 아니다. (명세 7.1)
    onMatchFinished: (result) => reportMatch(result, roomId, token),
  });
  const ranking = useRanking(loadRanking);
  const venue = venueOfRoom(roomId);

  return (
    <ScaledStage className="h-dvh w-full">
      <ShuffleboardStageFor
        state={state}
        now={now}
        link={link}
        local={socketBase === null}
        joinUrlOf={(seat) => joinUrlOf(roomId, seat)}
        ranking={ranking}
        venue={venue}
        header={
          <header className="flex h-14 shrink-0 items-center gap-6">
            <Logo size="lg" />
            <span className="text-[30px] font-extrabold tracking-tight text-ink-muted">
              셔플보드{venue ? ` · ${VENUE_LABEL[venue]}` : ""}
            </span>
            <span className="ml-auto text-[26px] text-ink-subtle tabular-nums">
              {state.round}번째 경기
            </span>
            {shuffleboardApi.demo && (
              <span className="text-[22px] text-warning">데모 저장(이 브라우저)</span>
            )}
            <LinkBadge local={socketBase === null} status={link} />
          </header>
        }
      />
    </ScaledStage>
  );
}
