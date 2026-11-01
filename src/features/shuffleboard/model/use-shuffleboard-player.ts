import { useCallback, useEffect, useRef, useState } from "react";
import { seatOf } from "@/entities/game/model/shuffleboard";
import type {
  JoinRejection,
  MatchClientMessage,
  MatchHostMessage,
  MatchState,
  Seat,
} from "@/entities/game/model/shuffleboard";
import { createBroadcastGameChannel } from "@/shared/lib/game-channel";
import type { GameChannel } from "@/shared/lib/game-channel";
import { createWsClientChannel } from "@/shared/lib/ws-game-channel";
import type { GameLinkStatus } from "@/shared/lib/ws-game-channel";

/**
 * 폰 쪽 셔플보드. 로그인·닉네임 없이 TV의 팀별 QR로 바로 참가한다.
 *
 * 조준은 폰에서 바로 그리고, 손을 뗄 때 각도와 힘만 한 번 보낸다. 손가락 좌표를
 * 계속 보내지 않으므로 폰↔TV 지연(약 0.8~0.9초)이 조작감에 섞이지 않는다. (명세 6장)
 */
/** TV가 이 시간 넘게 말이 없으면 연결이 끊겼다고 본다. */
const SILENCE_MS = 3_000;

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 같은 탭이면 새로고침해도 같은 참가자다. 경기 중 끊겨도 돌아와 이어 한다. */
function playerIdOf(roomId: string): string {
  const key = `flyerg:shuffleboard-player:${roomId}`;
  try {
    const saved = window.sessionStorage.getItem(key);
    if (saved) return saved;
    const created = randomId();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return randomId();
  }
}

/**
 * 끝난 경기의 내 결과. 방은 바로 다음 참가자를 받으므로 TV 상태에서 내가 빠져도
 * 이 폰에서는 결과 화면(설문 안내 포함)을 이어 간다.
 */
export interface FinishedMatch {
  roomId: string;
  matchId: string;
  seat: Seat;
  myScore: number;
  opponentScore: number;
  result: "WIN" | "LOSE" | "DRAW";
  finishedAt: number;
}

const finishedKey = (roomId: string) => `flyerg:shuffleboard-finished:${roomId}`;

function readStored<T>(key: string): T | null {
  try {
    const saved = window.sessionStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 기억한다.
  }
}

export interface UseShuffleboardPlayerOptions {
  socketBase?: string | null;
  /** 테스트 주입용 */
  channel?: GameChannel<MatchHostMessage, MatchClientMessage>;
}

export function useShuffleboardPlayer(roomId: string, options: UseShuffleboardPlayerOptions = {}) {
  const { channel: injected, socketBase = null } = options;
  const [link, setLink] = useState<GameLinkStatus | null>(null);
  const [playerId] = useState(() => playerIdOf(roomId));
  const [state, setState] = useState<MatchState | null>(null);
  const [rejection, setRejection] = useState<JoinRejection | null>(null);
  const [connected, setConnected] = useState(false);
  const [finished, setFinished] = useState<FinishedMatch | null>(() =>
    readStored<FinishedMatch>(finishedKey(roomId)),
  );
  /** 이번에 보낸 발사의 턴. TV가 받아 줄 때까지 같은 턴에 다시 못 쏘게 한다. */
  const [pendingTurn, setPendingTurn] = useState<number | null>(null);
  const channelRef = useRef<GameChannel<MatchHostMessage, MatchClientMessage> | null>(null);
  const heardAtRef = useRef(0);

  useEffect(() => {
    const channel =
      injected ??
      (socketBase
        ? createWsClientChannel<MatchHostMessage, MatchClientMessage>(socketBase, roomId, {
            onStatus: setLink,
          })
        : createBroadcastGameChannel<MatchHostMessage, MatchClientMessage>(
            `shuffleboard:${roomId}`,
          ));
    channelRef.current = channel;

    const unsubscribe = channel.subscribe((message) => {
      heardAtRef.current = Date.now();
      setConnected(true);
      if (message.kind === "state") {
        const next = message.state;
        setState(next);
        const seat = seatOf(next, playerId);
        if (seat && next.phase === "FINISHED" && next.winner) {
          const other: Seat = seat === "A" ? "B" : "A";
          const record: FinishedMatch = {
            roomId,
            matchId: next.matchId,
            seat,
            myScore: next.scores[seat],
            opponentScore: next.scores[other],
            result: next.winner === "DRAW" ? "DRAW" : next.winner === seat ? "WIN" : "LOSE",
            finishedAt: Date.now(),
          };
          setFinished((current) => {
            if (current?.matchId === record.matchId) return current;
            writeStored(finishedKey(roomId), record);
            return record;
          });
        }
      } else if (message.playerId === playerId) {
        setRejection(message.reason);
      }
    });
    channel.send({ kind: "hello", playerId });

    const watch = window.setInterval(() => {
      if (Date.now() - heardAtRef.current > SILENCE_MS) setConnected(false);
    }, 1_000);

    return () => {
      window.clearInterval(watch);
      unsubscribe();
      channel.send({ kind: "leave", playerId });
      if (!injected) channel.close();
      channelRef.current = null;
    };
  }, [roomId, injected, playerId, socketBase]);

  const join = useCallback(
    (seat: Seat | null) => {
      setRejection(null);
      channelRef.current?.send({ kind: "join", playerId, seat });
    },
    [playerId],
  );

  const shoot = useCallback(
    (angle: number, power: number) => {
      if (!state) return;
      setPendingTurn(state.turn);
      channelRef.current?.send({ kind: "shoot", playerId, turn: state.turn, angle, power });
    },
    [playerId, state],
  );

  /** 결과 화면을 닫고 다음 경기에 참가할 수 있게 한다. */
  const dismissFinished = useCallback(() => {
    writeStored(finishedKey(roomId), null);
    setFinished(null);
  }, [roomId]);

  const mySeat = state ? seatOf(state, playerId) : null;
  const waitingForTv = pendingTurn !== null && state?.turn === pendingTurn && state.rollingUntil === null;

  return {
    playerId,
    state,
    mySeat,
    rejection,
    connected,
    link,
    finished,
    /** 보낸 발사를 TV가 아직 받지 않았다(지연 중) */
    waitingForTv,
    join,
    shoot,
    dismissFinished,
  };
}
