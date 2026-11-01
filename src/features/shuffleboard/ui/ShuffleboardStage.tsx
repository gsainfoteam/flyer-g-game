import type { ReactNode } from "react";
import {
  SEATS,
  secondsLeft,
  seatOfTurn,
  shooterSeat,
  shotsTaken,
} from "@/entities/game/model/shuffleboard";
import type { MatchState, Seat } from "@/entities/game/model/shuffleboard";
import { SHUFFLEBOARD_RULES } from "@/entities/game/model/shuffleboard-rules";
import type { RankingSnapshot } from "@/entities/ranking/api/ranking-source";
import { QRCodeBox } from "@/shared/components/QRCodeBox";
import { VENUES, VENUE_LABEL } from "@/shared/config/venue";
import type { Venue } from "@/shared/config/venue";
import { cn } from "@/shared/lib/utils";
import { BoardView } from "./BoardView";
import { SEAT_DOT, SEAT_TEXT } from "./seat-style";

/**
 * 셔플보드 TV 화면의 본문. 단독 게임 화면과 전단지 플레이어의 게임 위젯이 함께 쓴다.
 * (클릭 배틀의 `ClickBattleBoard`와 같은 자리)
 *
 * 이 화면이 답하는 질문은 하나다. "지금 누구 차례고, 누가 이기고 있나."
 * 그래서 경기 중에는 보드를 화면 폭 전체로 두고, 그 아래 두 팀의 점수를 가장 크게 쓴다.
 * 모집 중에는 QR이 주인공이다. 1920x1080 기준 px이고, 축소는 감싸는 쪽이 한다.
 */

function statusOf(state: MatchState, seconds: number | null): { title: string; detail: string } {
  switch (state.phase) {
    case "WAITING": {
      const seated = SEATS.filter((seat) => state.seats[seat]).length;
      return seated === 0
        ? { title: "두 명이 모이면 시작해요", detail: "QR을 찍고 닉네임을 적어 주세요" }
        : { title: "한 명 더 오면 시작해요", detail: "A팀이 기다리고 있어요" };
    }
    case "READY":
      return { title: `${seconds ?? 0}초 뒤 시작`, detail: "A팀이 먼저 던져요" };
    case "PLAYING": {
      const seat = seatOfTurn(state.turn);
      return shooterSeat(state)
        ? { title: `${seat}팀 차례`, detail: `${seconds ?? 0}초 안에 던지세요` }
        : { title: `${seat}팀이 던졌어요`, detail: "원반이 멈추면 다음 차례예요" };
    }
    case "FINISHED":
      return {
        title: state.winner === "DRAW" ? "무승부" : `${state.winner}팀 승리`,
        detail: "폰에서 로그인하고 설문을 내면 랭킹에 올라가요",
      };
  }
}

interface ShuffleboardStageProps {
  state: MatchState;
  now: number;
  /** QR에 넣을 폰 참가 주소. 연결 준비 전이면 null */
  joinUrl: string | null;
  /** QR을 띄울 수 없을 때 그 자리에 적을 말 */
  closedLabel: string;
  ranking: RankingSnapshot & { live: boolean };
  /** 이 TV의 장소. 랭킹 그룹에서 이 장소를 강조한다. */
  venue: Venue | null;
  /** 맨 위 머리 줄. 화면마다 다르다. */
  header: ReactNode;
}

export function ShuffleboardStage({
  state,
  now,
  joinUrl,
  closedLabel,
  ranking,
  venue,
  header,
}: ShuffleboardStageProps) {
  const seconds = secondsLeft(state, now);
  const status = statusOf(state, seconds);
  const inMatch = state.phase === "PLAYING" || state.phase === "FINISHED";

  return (
    <div className="flex h-full flex-col gap-8">
      {header}

      <div className="flex shrink-0 items-end gap-10">
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "text-[88px] leading-none font-extrabold tracking-tight tabular-nums",
              state.phase === "FINISHED" && state.winner && state.winner !== "DRAW"
                ? SEAT_TEXT[state.winner]
                : state.phase === "PLAYING"
                  ? SEAT_TEXT[seatOfTurn(state.turn)]
                  : "text-ink",
            )}
          >
            {status.title}
          </h1>
          <p className="mt-4 text-[34px] text-ink-muted">{status.detail}</p>
        </div>
        <VenueBest ranking={ranking} venue={venue} />
      </div>

      {inMatch ? (
        <>
          <div className="shrink-0 rounded-tv-card bg-surface p-6">
            <BoardView
              orientation="horizontal"
              pucks={state.pucks}
              lastShot={state.lastShot}
              rolling={state.rollingUntil !== null}
              matchId={state.matchId}
              labelSize={16}
              className="h-[388px] w-full"
            />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-8">
            {SEATS.map((seat) => (
              <SeatPanel key={seat} seat={seat} state={state} />
            ))}
          </div>
        </>
      ) : (
        <Lobby state={state} joinUrl={joinUrl} closedLabel={closedLabel} ranking={ranking} />
      )}
    </div>
  );
}

function VenueBest({
  ranking,
  venue,
}: {
  ranking: RankingSnapshot & { live: boolean };
  venue: Venue | null;
}) {
  return (
    <section aria-label="장소별 최고 점수" className="flex shrink-0 gap-8 rounded-tv-card bg-surface px-10 py-6">
      {VENUES.map((item) => (
        <div key={item} className="min-w-[150px]">
          <p className={cn("text-[26px] font-bold", item === venue ? "text-ink" : "text-ink-subtle")}>
            {VENUE_LABEL[item]} 최고
          </p>
          <p className="mt-1 text-[56px] leading-none font-extrabold tabular-nums text-ink">
            {ranking.venueBest[item] ?? "–"}
          </p>
        </div>
      ))}
    </section>
  );
}

function SeatPanel({ seat, state }: { seat: Seat; state: MatchState }) {
  const taken = shotsTaken(state, seat);
  const shooting = state.phase === "PLAYING" && seatOfTurn(state.turn) === seat;
  const isWinner = state.phase === "FINISHED" && state.winner === seat;
  return (
    <section
      aria-label={`${seat}팀`}
      className={cn(
        "flex min-h-0 items-center gap-10 rounded-tv-card px-14 py-8",
        shooting || isWinner ? "bg-surface-muted" : "bg-surface",
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className={cn("text-[56px] font-extrabold", SEAT_TEXT[seat])}>{seat}팀</h2>
        <div className="mt-4 flex items-center gap-3" aria-label={`${taken}번 던짐`}>
          {Array.from({ length: SHUFFLEBOARD_RULES.shotsPerSeat }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-6 rounded-pill",
                index < taken ? "bg-surface-muted" : SEAT_DOT[seat],
              )}
            />
          ))}
          <span className="ml-3 text-[28px] text-ink-subtle tabular-nums">
            {SHUFFLEBOARD_RULES.shotsPerSeat - taken}개 남음
          </span>
        </div>
      </div>
      <p className={cn("text-[150px] leading-none font-extrabold tracking-tight tabular-nums", SEAT_TEXT[seat])}>
        {state.scores[seat]}
      </p>
    </section>
  );
}

function Lobby({
  state,
  joinUrl,
  closedLabel,
  ranking,
}: {
  state: MatchState;
  joinUrl: string | null;
  closedLabel: string;
  ranking: RankingSnapshot & { live: boolean };
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-8">
      <section className="flex items-center gap-14 rounded-tv-card bg-surface px-14 py-12">
        <div className="flex w-[300px] shrink-0 flex-col items-center gap-5">
          {joinUrl ? (
            <QRCodeBox value={joinUrl} size="tv" />
          ) : (
            <p className="grid size-[240px] place-items-center text-center text-[26px] leading-snug whitespace-pre-line text-ink-subtle">
              {closedLabel}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h2 className="text-[44px] leading-tight font-extrabold text-ink">찍고 참가하기</h2>
          {SEATS.map((seat) => (
            <div key={seat} className="flex items-center gap-5">
              <span
                className={cn(
                  "size-7 shrink-0 rounded-pill",
                  state.seats[seat] ? SEAT_DOT[seat] : "bg-surface-muted",
                )}
              />
              <p className="text-[34px] text-ink">
                <span className={cn("font-extrabold", SEAT_TEXT[seat])}>{seat}팀</span>{" "}
                {state.seats[seat] ? "준비됐어요" : "빈 자리"}
              </p>
            </div>
          ))}
          <p className="text-[26px] leading-snug text-ink-subtle">
            번갈아 {SHUFFLEBOARD_RULES.shotsPerSeat}번씩 던져요. 끝났을 때 보드에 남은 원반으로 점수를 매겨요.
          </p>
        </div>
      </section>

      <section aria-label="랭킹" className="flex min-h-0 flex-col rounded-tv-card bg-surface px-14 py-12">
        <h2 className="text-[44px] font-extrabold text-ink">개인 랭킹</h2>
        {ranking.top.length > 0 ? (
          <ol className="mt-8 flex flex-col gap-5">
            {ranking.top.slice(0, 3).map((entry, index) => (
              <li key={`${entry.name}-${index}`} className="flex items-baseline gap-6">
                <span className="w-12 text-[40px] font-extrabold text-ink-subtle tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[40px] font-bold text-ink">
                  {entry.name}
                </span>
                <span className="text-[48px] font-extrabold text-ink tabular-nums">{entry.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-8 text-[30px] leading-snug text-ink-muted">
            {ranking.live
              ? "아직 등록된 기록이 없어요. 첫 기록의 주인공이 되어 보세요."
              : "랭킹은 서버를 연결하면 보여요."}
          </p>
        )}
        <p className="mt-auto text-[24px] leading-snug text-ink-subtle">
          랭킹에는 닉네임만 보여요. 로그인과 설문을 마친 기록만 올라가요.
        </p>
      </section>
    </div>
  );
}
