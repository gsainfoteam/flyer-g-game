import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  SEATS,
  displayedScores,
  secondsLeft,
  seatOfTurn,
  shooterSeat,
  shotsTaken,
} from "@/entities/game/model/shuffleboard";
import type { MatchState, Seat } from "@/entities/game/model/shuffleboard";
import { SHUFFLEBOARD_RULES } from "@/entities/game/model/shuffleboard-rules";
import { gameSocketBase } from "@/features/shuffleboard/api/game-socket";
import { useShuffleboardPlayer } from "@/features/shuffleboard/model/use-shuffleboard-player";
import type { FinishedMatch } from "@/features/shuffleboard/model/use-shuffleboard-player";
import { AimPad } from "@/features/shuffleboard/ui/AimPad";
import { BoardView } from "@/features/shuffleboard/ui/BoardView";
import { SEAT_TEXT } from "@/features/shuffleboard/ui/seat-style";
import { surveyUrl } from "@/shared/config/survey";
import { VENUE_LABEL, venueOfRoom } from "@/shared/config/venue";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

/**
 * 셔플보드 참가 (폰). TV의 팀별 QR로 들어와 버튼 하나로 참가한다. 로그인·닉네임은 없다.
 *
 * 경기가 끝나면 이 폰에 결과와 설문(노션폼) 안내가 남는다. TV 방은 그사이 다음
 * 참가자를 받는다.
 */

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function ShuffleboardPlayPage() {
  const { roomId = "old" } = useParams();
  const [searchParams] = useSearchParams();
  // TV의 팀별 QR이 정한 팀. QR 없이 들어오면 빈 자리에 앉는다.
  const team = searchParams.get("team");
  const qrSeat: Seat | null = team === "A" || team === "B" ? team : null;
  const player = useShuffleboardPlayer(roomId, { socketBase: gameSocketBase() });
  const now = useNow();
  const venue = venueOfRoom(roomId);
  const state = player.state;

  // 끝난 경기의 결과가 있으면 방 상태와 상관없이 결과 화면을 이어 간다.
  if (player.finished) {
    return (
      <FinishView
        finished={player.finished}
        room={state}
        now={now}
        qrSeat={qrSeat}
        onRejoin={(seat) => {
          player.dismissFinished();
          player.join(seat);
        }}
      />
    );
  }

  if (!player.connected || !state) {
    return (
      <Notice
        title={player.link === "waiting-host" ? "TV가 아직 게임을 열지 않았어요" : "TV에 연결하는 중이에요"}
        description={
          player.link === "waiting-host"
            ? "TV에 셔플보드 화면이 켜지면 바로 이어져요. 이 화면을 열어 두세요."
            : "인터넷 연결을 확인해 주세요. 계속 안 되면 TV 화면의 QR을 다시 찍어 보세요."
        }
      />
    );
  }

  const seconds = secondsLeft(state, now);
  const seat = player.mySeat;

  // TV가 방금 끝난 경기의 결과를 띄우는 동안. 몇 초 뒤 방이 비면 참가 화면으로 바뀐다.
  if (state.phase === "FINISHED") {
    return (
      <Notice
        title="다음 경기를 준비하고 있어요"
        description={`${seconds ?? 0}초쯤 뒤에 참가할 수 있어요. 이 화면을 열어 두세요.`}
      />
    );
  }

  if (!seat) {
    if (state.phase !== "WAITING") {
      return (
        <Notice
          title="지금은 경기 중이에요"
          description="경기가 끝나면 다음 두 명을 받아요. 이 화면을 열어 두세요."
        />
      );
    }
    const nextSeat: Seat = qrSeat ?? (state.seats.A ? "B" : "A");
    const otherSeat: Seat = nextSeat === "A" ? "B" : "A";
    return (
      <div className="flex flex-1 flex-col gap-6 pt-4">
        <div>
          <h1 className="text-title text-ink">
            셔플보드{venue ? ` · ${VENUE_LABEL[venue]}` : ""}
          </h1>
          <p className="mt-2 text-body text-ink-muted">
            <span className={cn("font-bold", SEAT_TEXT[nextSeat])}>{nextSeat}팀</span>으로 참가해요.
            두 명이 모이면 바로 시작하고, 번갈아 {SHUFFLEBOARD_RULES.shotsPerSeat}번씩 던져요.
          </p>
        </div>
        {player.rejection && (
          <p role="alert" className="text-label text-danger">
            {player.rejection === "FULL"
              ? "방금 두 자리가 다 찼어요. 이 경기가 끝나면 다시 참가해 주세요."
              : player.rejection === "TAKEN"
                ? `${nextSeat}팀 자리에 이미 누가 있어요. TV의 ${otherSeat}팀 QR을 찍어 주세요.`
                : "방금 경기가 시작됐어요. 다음 경기를 기다려 주세요."}
          </p>
        )}
        <Button
          size="lg"
          className="mt-auto h-14 text-subhead"
          onClick={() => player.join(qrSeat)}
        >
          {nextSeat}팀으로 참가하기
        </Button>
      </div>
    );
  }

  if (state.phase === "WAITING" || state.phase === "READY") {
    return (
      <Notice
        title={state.phase === "READY" ? `${seconds ?? 0}초 뒤 시작해요` : "상대를 기다리는 중이에요"}
        description={`${seat}팀으로 참가했어요. ${seat === "A" ? "먼저" : "두 번째로"} 던져요.`}
      />
    );
  }

  // PLAYING (FINISHED는 위에서 결과 화면으로 넘어간다)
  const myTurn = shooterSeat(state) === seat;
  const enabled = myTurn && !player.waitingForTv;
  return (
    <div className="flex flex-1 flex-col gap-4 pt-1">
      <Scoreboard state={state} mySeat={seat} />
      <p className={cn("text-heading", myTurn ? SEAT_TEXT[seat] : "text-ink-muted")} aria-live="polite">
        {myTurn
          ? player.waitingForTv
            ? "던졌어요! TV를 보세요"
            : `내 차례 · ${seconds ?? 0}초`
          : state.rollingUntil !== null
            ? "원반이 굴러가는 중이에요"
            : `${seatOfTurn(state.turn)}팀 차례예요`}
      </p>
      <div className="rounded-card bg-surface p-3">
        <BoardView
          orientation="vertical"
          pucks={state.pucks}
          lastShot={state.lastShot}
          rolling={state.rollingUntil !== null}
          matchId={state.matchId}
          from={190}
          to={412}
          labelSize={12}
          className="mx-auto h-[26dvh] w-full"
        />
      </div>
      <AimPad seat={seat} enabled={enabled} onShoot={player.shoot} />
    </div>
  );
}

function Scoreboard({ state, mySeat }: { state: MatchState; mySeat: Seat }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SEATS.map((seat) => (
        <div
          key={seat}
          className={cn("rounded-card px-4 py-3", seat === mySeat ? "bg-surface" : "bg-surface-muted")}
        >
          <p className={cn("text-label font-bold", SEAT_TEXT[seat])}>
            {seat}팀{seat === mySeat ? " · 나" : ""}
          </p>
          <p className="flex items-baseline justify-between">
            <span className="text-title text-ink tabular-nums">{displayedScores(state)[seat]}</span>
            <span className="text-caption text-ink-subtle tabular-nums">
              {SHUFFLEBOARD_RULES.shotsPerSeat - shotsTaken(state, seat)}개 남음
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * 경기 종료 화면. 방은 다음 참가자를 받고, 이 폰에는 결과와 설문 안내가 남는다.
 *
 * 한 판만 하고 가는 사람이 대부분이라 "다음 경기"를 권하지 않는다. 설문에 참여하거나
 * 건너뛰면 "끝났어요"로 마무리한다. 다시 하고 싶은 사람만 쓰도록 작은 글씨로 길을 둔다.
 * 설문은 노션폼이다. TV 오른쪽 위 QR과 같은 주소라 여기서 바로 열 수 있다.
 */
function FinishView({
  finished,
  room,
  now,
  qrSeat,
  onRejoin,
}: {
  finished: FinishedMatch;
  /** 지금 TV 방 상태. 다시 참가할 수 있는지 보여 준다. */
  room: MatchState | null;
  now: number;
  qrSeat: Seat | null;
  onRejoin: (seat: Seat | null) => void;
}) {
  const [ended, setEnded] = useState<"survey" | "skipped" | null>(null);
  const survey = surveyUrl();

  if (ended) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4 text-center">
        <h1 className="text-title text-ink">
          {ended === "survey" ? "설문에 참여해 줘서 고마워요" : "함께해 줘서 고마워요"}
        </h1>
        <p className="text-body text-ink-muted">게임이 끝났어요. 이 창은 닫아도 돼요.</p>
        <Rejoin room={room} now={now} qrSeat={qrSeat} onRejoin={onRejoin} />
      </div>
    );
  }

  const title =
    finished.result === "DRAW" ? "무승부예요" : finished.result === "WIN" ? "이겼어요!" : "아쉽게 졌어요";
  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <h1 className="text-title text-ink">{title}</h1>

      <div className="flex items-end justify-between rounded-card bg-surface px-5 py-4">
        <div>
          <p className={cn("text-label font-bold", SEAT_TEXT[finished.seat])}>{finished.seat}팀 · 나</p>
          <p className="text-[56px] leading-none font-extrabold text-ink tabular-nums">
            {finished.myScore}
            <span className="ml-1 text-subhead text-ink-muted">점</span>
          </p>
        </div>
        <p className="text-body text-ink-muted tabular-nums">상대 {finished.opponentScore}점</p>
      </div>

      {survey && (
        <div className="flex flex-col gap-2 rounded-card bg-surface px-5 py-4">
          <h2 className="text-heading text-ink">전단지 설문에 참여해 주세요</h2>
          <p className="text-body text-ink-muted">
            로비 TV 게시판을 써 본 느낌을 들려주세요. 1분이면 끝나요.
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {survey && (
          <Button asChild size="lg" className="h-14 text-subhead">
            <a
              href={survey}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setEnded("survey")}
            >
              설문 참여하기
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className="h-14 text-subhead"
          onClick={() => setEnded("skipped")}
        >
          {survey ? "건너뛰기" : "끝내기"}
        </Button>
      </div>
    </div>
  );
}

/**
 * 다시 참가하기. 전단지 클릭 배틀과 같은 규칙이다: 결과를 보여 준 뒤 방을 비우고, 같은
 * 폰에서 참가 버튼을 다시 누르면 들어간다. 자동 재경기나 먼저 했던 사람의 우선권은 없다.
 */
function Rejoin({
  room,
  now,
  qrSeat,
  onRejoin,
}: {
  room: MatchState | null;
  now: number;
  qrSeat: Seat | null;
  onRejoin: (seat: Seat | null) => void;
}) {
  if (!room) return null;
  if (room.phase === "FINISHED") {
    const seconds = secondsLeft(room, now) ?? 0;
    return <p className="mt-8 text-label text-ink-subtle">{seconds}초 뒤 다음 경기를 모집해요</p>;
  }
  if (room.phase !== "WAITING") {
    return (
      <p className="mt-8 text-label text-ink-subtle">
        지금은 다른 사람이 경기 중이에요. 끝나면 다시 참가할 수 있어요.
      </p>
    );
  }
  const seat = qrSeat ?? (room.seats.A ? "B" : "A");
  if (room.seats[seat]) {
    const other: Seat = seat === "A" ? "B" : "A";
    return (
      <p className="mt-8 text-label text-ink-subtle">
        {seat}팀 자리에 누가 있어요. 다시 하려면 TV의 {other}팀 QR을 찍어 주세요.
      </p>
    );
  }
  return (
    <Button variant="outline" size="lg" className="mt-8 h-14 text-subhead" onClick={() => onRejoin(qrSeat)}>
      {seat}팀으로 다시 참가하기
    </Button>
  );
}

function Notice({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div role="status" className="flex flex-1 flex-col justify-center gap-4 text-center">
      <h1 className="text-title text-ink">{title}</h1>
      <p className="text-body text-ink-muted">{description}</p>
      {children}
    </div>
  );
}
