import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router";
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
import { VENUE_LABEL, venueOfRoom } from "@/shared/config/venue";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * 셔플보드 참가 (폰). TV의 QR 하나로 로그인 없이 들어와 닉네임만 적는다.
 * 먼저 들어온 사람이 A팀, 다음 사람이 B팀이다.
 *
 * 경기가 끝나면 이 폰에서 결과 → 인포팀 로그인 → 설문 순서로 이어진다. TV 방은 그사이
 * 다음 참가자를 받는다.
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
  const player = useShuffleboardPlayer(roomId, { socketBase: gameSocketBase() });
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const now = useNow();
  const venue = venueOfRoom(roomId);
  const state = player.state;

  // 끝난 경기의 결과가 있으면 방 상태와 상관없이 결과 화면을 이어 간다.
  if (player.finished) {
    return <FinishView finished={player.finished} onNext={player.dismissFinished} />;
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

  if (!seat) {
    if (state.phase !== "WAITING") {
      return (
        <Notice
          title="지금은 경기 중이에요"
          description="경기가 끝나면 다음 두 명을 받아요. 이 화면을 열어 두세요."
        />
      );
    }
    const nextSeat: Seat = state.seats.A ? "B" : "A";
    return (
      <form
        className="flex flex-1 flex-col gap-6 pt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setJoining(true);
          await player.join(name);
          setJoining(false);
        }}
      >
        <div>
          <h1 className="text-title text-ink">
            셔플보드{venue ? ` · ${VENUE_LABEL[venue]}` : ""}
          </h1>
          <p className="mt-2 text-body text-ink-muted">
            지금 들어가면 <span className={cn("font-bold", SEAT_TEXT[nextSeat])}>{nextSeat}팀</span>이에요.
            로그인은 경기가 끝난 뒤에 해요.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="nickname" className="text-label font-bold text-ink">
            닉네임
          </label>
          <Input
            id="nickname"
            value={name}
            maxLength={SHUFFLEBOARD_RULES.nameMaxLength}
            placeholder="예: 3층 하윤"
            aria-describedby="nickname-hint"
            onChange={(event) => setName(event.target.value)}
            className="h-12 text-subhead"
          />
          <p id="nickname-hint" className="text-caption text-ink-subtle">
            랭킹에 오르면 TV에 이 이름이 보여요. 실명은 적지 않아도 돼요.
            최대 {SHUFFLEBOARD_RULES.nameMaxLength}자.
          </p>
        </div>
        {player.rejection && (
          <p role="alert" className="text-label text-danger">
            {player.rejection === "FULL"
              ? "방금 두 자리가 다 찼어요. 이 경기가 끝나면 다시 참가해 주세요."
              : "방금 경기가 시작됐어요. 다음 경기를 기다려 주세요."}
          </p>
        )}
        <Button type="submit" size="lg" disabled={joining} className="mt-auto h-14 text-subhead">
          참가하기
        </Button>
      </form>
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
 * 경기 종료 화면. 점수는 아직 "임시 저장"이다. 인포팀 로그인과 설문 제출이 서버에서
 * 확인돼야 랭킹에 오른다. (명세 7장)
 *
 * 서버가 아직 없어 두 단계 버튼은 꺼 두었다. 누르면 성공한 것처럼 보이는 가짜 흐름을
 * 만들지 않는다.
 */
function FinishView({ finished, onNext }: { finished: FinishedMatch; onNext: () => void }) {
  const title =
    finished.result === "DRAW" ? "무승부예요" : finished.result === "WIN" ? "이겼어요!" : "아쉽게 졌어요";
  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <div>
        <h1 className="text-title text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink">
          게임이 종료되었습니다! 랭킹에 점수를 등록하려면 인포팀 로그인과 설문 제출을 완료해 주세요.
        </p>
      </div>

      <div className="flex items-end justify-between rounded-card bg-surface px-5 py-4">
        <div>
          <p className={cn("text-label font-bold", SEAT_TEXT[finished.seat])}>
            {finished.seat}팀 · {finished.name}
          </p>
          <p className="text-[56px] leading-none font-extrabold text-ink tabular-nums">
            {finished.myScore}
            <span className="ml-1 text-subhead text-ink-muted">점</span>
          </p>
        </div>
        <p className="text-body text-ink-muted tabular-nums">상대 {finished.opponentScore}점</p>
      </div>

      <ol className="flex flex-col gap-3">
        <Step available={false} title="인포팀으로 로그인" detail="이 기록이 내 것임을 확인해요." />
        <Step available={false} title="설문 작성하기" detail="로그인한 뒤에 열려요. 제출까지 해야 랭킹에 올라가요." />
      </ol>
      <p role="note" className="rounded-card bg-surface-muted px-4 py-3 text-label text-ink-muted">
        시제품이라 로그인·설문 서버가 아직 연결되지 않았어요. 이 점수는 랭킹에 오르지 않아요.
      </p>

      <Button variant="outline" size="lg" className="mt-auto h-14 text-subhead" onClick={onNext}>
        다음 경기 참가하기
      </Button>
    </div>
  );
}

function Step({ title, detail, available }: { title: string; detail: string; available: boolean }) {
  return (
    <li className="flex flex-col gap-1 rounded-card bg-surface px-5 py-4">
      <Button size="lg" disabled={!available} className="h-12 w-full text-subhead">
        {title}
      </Button>
      <p className="text-caption text-ink-subtle">{detail}</p>
    </li>
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
