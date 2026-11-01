import type { ReactNode } from "react";
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
import type { RankingSnapshot } from "@/entities/game/api/contract";
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
      const seated = SEATS.filter((seat) => state.seats[seat]);
      const empty = SEATS.find((seat) => !state.seats[seat]);
      return seated.length === 0
        ? { title: "두 명이 모이면 시작해요", detail: "원하는 팀의 QR을 찍고 닉네임을 적어 주세요" }
        : {
            title: "한 명 더 오면 시작해요",
            detail: `${seated[0]}팀이 기다리고 있어요. ${empty}팀 QR을 찍어 주세요`,
          };
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
  /** 팀별 QR에 넣을 폰 참가 주소. 연결 준비 전이거나 그 자리가 찼으면 null */
  joinUrls: Record<Seat, string | null>;
  /** QR을 띄울 수 없을 때 그 자리에 적을 말 */
  closedLabel: string;
  ranking: RankingSnapshot;
  /** 이 TV의 장소. 랭킹 그룹에서 이 장소를 강조한다. */
  venue: Venue | null;
  /** 맨 위 머리 줄. 화면마다 다르다. */
  header: ReactNode;
}

export function ShuffleboardStage({
  state,
  now,
  joinUrls,
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
        <RankingCorner ranking={ranking} venue={venue} />
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
        <Lobby state={state} joinUrls={joinUrls} closedLabel={closedLabel} />
      )}
    </div>
  );
}

/**
 * 오른쪽 위 랭킹 자리. 경기 랭킹 1~3위와 구관/신관 최고 점수를 작게 모아 둔다.
 * 화면의 주인공은 두 팀이라 랭킹은 이 자리를 넘지 않는다.
 */
function RankingCorner({
  ranking,
  venue,
}: {
  ranking: RankingSnapshot;
  venue: Venue | null;
}) {
  return (
    <section
      aria-label="랭킹"
      className="flex shrink-0 gap-10 rounded-tv-card bg-surface px-9 py-5"
    >
      <div className="flex flex-col justify-center gap-2">
        {VENUES.map((item) => (
          <p key={item} className="flex items-baseline gap-4">
            <span
              className={cn(
                "w-[118px] text-[24px] font-bold",
                item === venue ? "text-ink" : "text-ink-subtle",
              )}
            >
              {VENUE_LABEL[item]} 최고
            </span>
            <span className="text-[40px] leading-none font-extrabold text-ink tabular-nums">
              {ranking.venueBest[item] ?? "–"}
            </span>
          </p>
        ))}
      </div>
      <ol aria-label="경기 랭킹" className="flex w-[330px] flex-col justify-center gap-1">
        {ranking.top.length > 0 ? (
          ranking.top.slice(0, 3).map((entry, index) => (
            <li key={entry.matchId} className="flex items-baseline gap-3 text-[24px]">
              <span className="w-5 font-extrabold text-ink-subtle tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-ink">{entry.name}</span>
              <span className="font-extrabold text-ink tabular-nums">{entry.score}</span>
            </li>
          ))
        ) : (
          <li className="text-[22px] leading-snug text-ink-subtle">
            이기고 설문까지 내면 랭킹에 올라가요
          </li>
        )}
      </ol>
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
                index < taken ? "bg-line-strong" : SEAT_DOT[seat],
              )}
            />
          ))}
          <span className="ml-3 text-[28px] text-ink-subtle tabular-nums">
            {SHUFFLEBOARD_RULES.shotsPerSeat - taken}개 남음
          </span>
        </div>
      </div>
      <p className={cn("text-[150px] leading-none font-extrabold tracking-tight tabular-nums", SEAT_TEXT[seat])}>
        {displayedScores(state)[seat]}
      </p>
    </section>
  );
}

function Lobby({
  state,
  joinUrls,
  closedLabel,
}: {
  state: MatchState;
  joinUrls: Record<Seat, string | null>;
  closedLabel: string;
}) {
  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-8">
        {SEATS.map((seat) => {
          const seated = state.seats[seat] !== null;
          const url = joinUrls[seat];
          return (
            <section
              key={seat}
              aria-label={`${seat}팀`}
              className="flex min-h-0 gap-10 rounded-tv-card bg-surface px-14 py-12"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className={cn("text-[56px] font-extrabold", SEAT_TEXT[seat])}>{seat}팀</h2>
                <p
                  className={cn(
                    "mt-auto text-[96px] leading-none font-extrabold tracking-tight",
                    seated ? SEAT_TEXT[seat] : "text-ink-subtle",
                  )}
                >
                  {seated ? "준비 완료" : "빈 자리"}
                </p>
                <p className="mt-6 text-[28px] text-ink-muted">
                  {seated ? "상대를 기다리고 있어요" : "QR을 찍고 닉네임을 적어 주세요"}
                </p>
              </div>
              <div className="flex w-[280px] shrink-0 flex-col items-center justify-end gap-4">
                {seated ? null : url ? (
                  <>
                    <QRCodeBox value={url} size="tv" />
                    <p className={cn("text-[32px] font-extrabold", SEAT_TEXT[seat])}>
                      {seat}팀으로 참가
                    </p>
                  </>
                ) : (
                  <p className="text-center text-[26px] leading-snug whitespace-pre-line text-ink-subtle">
                    {closedLabel}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="shrink-0 text-[24px] text-ink-subtle">
        1:1 대결 · 번갈아 {SHUFFLEBOARD_RULES.shotsPerSeat}번씩 던져요 · 끝났을 때 보드에 남은 원반으로 점수를 매겨요 ·
        이긴 사람이 로그인하고 설문을 내면 랭킹에 올라가요
      </p>
    </>
  );
}
