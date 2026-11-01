import { useEffect, useRef, useState } from "react";
import {
  advanceMatch,
  applyClientMessage,
  initialMatch,
} from "@/entities/game/model/shuffleboard";
import type {
  MatchClientMessage,
  MatchHostMessage,
  MatchState,
} from "@/entities/game/model/shuffleboard";
import { parseClientMessage } from "@/entities/game/model/shuffleboard-messages";
import { createBroadcastGameChannel } from "@/shared/lib/game-channel";
import type { GameChannel } from "@/shared/lib/game-channel";
import { createWsHostChannel } from "@/shared/lib/ws-game-channel";
import type { GameLinkStatus } from "@/shared/lib/ws-game-channel";
import { createPlayerBinding } from "./player-binding";

/**
 * TV 쪽 셔플보드. 경기 상태의 원본을 들고 폰 메시지를 받아 심판한다.
 * 클릭 배틀의 `useBattleHost`와 같은 모양이다.
 *
 * 화면 갱신과 상태 방송은 초당 5번으로 묶는다. 원반이 굴러가는 애니메이션은 이
 * 주기와 상관없이 보드 그림(`BoardView`)이 스스로 그린다.
 */
const FRAME_MS = 200;
/** 바뀐 것이 없어도 이만큼마다 상태를 보낸다. 폰은 이 신호로 연결을 확인한다. */
const HEARTBEAT_MS = 1_000;

export interface UseShuffleboardHostOptions {
  /** 백엔드 게임 중계 주소. 없으면 같은 브라우저 탭끼리만 잇는다(개발용). */
  socketBase?: string | null;
  /** 이 TV(기기)의 기기 토큰. 서버 중계로 방을 열 때 필요하다. */
  token?: string | null;
  /** 한 명만 들어온 채 이만큼 지나면 방을 비운다(위젯용). 없으면 기다린다. */
  lobbyWaitMs?: number;
  /** 누군가 들어온 뒤 이만큼 지나면 경기 중이 아닐 때 방을 비운다(위젯용). */
  sessionLimitMs?: number;
  /** 테스트 주입용 */
  channel?: GameChannel<MatchClientMessage, MatchHostMessage>;
  now?: () => number;
}

/** 누군가 들어와 방이 살아 있는가. 이 동안 전단지 플레이어는 순환을 멈춘다. */
export function isMatchActive(state: MatchState): boolean {
  return state.phase !== "WAITING" || state.seats.A !== null || state.seats.B !== null;
}

export function newMatchId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // randomUUID가 없는 환경(보안 연결이 아닌 주소)에서도 서버가 받는 UUID v4 모양으로 만든다.
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  random[6] = (random[6] & 0x0f) | 0x40;
  random[8] = (random[8] & 0x3f) | 0x80;
  const hex = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * TV를 새로고침해도 경기가 이어지게 이 탭에 상태를 남긴다. (명세 13장 "TV 새로고침")
 * 시각은 모두 절대 시각(ms)이라 그대로 되살리면 남은 시간도 맞다.
 */
const storageKey = (roomId: string) => `flyerg:shuffleboard-host:${roomId}`;

function restore(roomId: string): MatchState {
  try {
    const saved = window.sessionStorage.getItem(storageKey(roomId));
    if (saved) return JSON.parse(saved) as MatchState;
  } catch {
    // 저장소를 못 쓰면 새 경기로 시작한다.
  }
  return initialMatch(1, newMatchId());
}

function save(roomId: string, state: MatchState) {
  try {
    window.sessionStorage.setItem(storageKey(roomId), JSON.stringify(state));
  } catch {
    // 저장소를 못 써도 경기는 계속한다.
  }
}

export function useShuffleboardHost(roomId: string, options: UseShuffleboardHostOptions = {}) {
  const {
    channel: injected,
    now = Date.now,
    socketBase = null,
    token = null,
    lobbyWaitMs,
    sessionLimitMs,
  } = options;
  const [status, setStatus] = useState<GameLinkStatus | null>(null);
  const [state, setState] = useState<MatchState>(() => restore(roomId));
  const stateRef = useRef<MatchState>(state);
  const [clock, setClock] = useState(() => now());

  useEffect(() => {
    // 기기 토큰이 없으면 방을 열 수 없다. 설정 링크로 다시 열어야 한다.
    if (socketBase && !token && !injected) return;

    // 폰은 자기 참가자 id를 스스로 정한다. 서버 연결 id에 묶어 남의 id를 못 쓰게 한다.
    const binding = createPlayerBinding();
    const channel =
      injected ??
      (socketBase && token
        ? createWsHostChannel<MatchClientMessage, MatchHostMessage>(socketBase, roomId, {
            token,
            onStatus: setStatus,
            // 탭을 닫은 폰은 "나간다"를 못 보낸다. 연결이 끊기면 그 연결의 참가자를 내보낸다.
            // 경기 중이면 엔진이 무시하고 자리를 지킨다.
            onDisconnect: (from) => {
              const playerId = binding.release(from);
              return playerId === null ? null : { kind: "leave", playerId };
            },
          })
        : createBroadcastGameChannel<MatchClientMessage, MatchHostMessage>(
            `shuffleboard:${roomId}`,
          ));
    let dirty = true;
    let sentAt = 0;
    let activeSince: number | null = null;
    let waitingSince: number | null = null;

    const commit = (next: MatchState) => {
      if (next === stateRef.current) return;
      stateRef.current = next;
      dirty = true;
      save(roomId, next);
    };

    const unsubscribe = channel.subscribe((raw, from) => {
      // 폰은 로그인하지 않는다. 모양이 틀리거나 남의 참가자 id를 쓴 메시지는 버린다.
      const message = parseClientMessage(raw);
      if (!message || !binding.claim(from, message.playerId)) return;
      const result = applyClientMessage(stateRef.current, message, now());
      commit(result.state);
      if (result.reply) channel.send(result.reply);
      if (message.kind === "hello") {
        channel.send({ kind: "state", state: stateRef.current });
      }
    });

    const timer = window.setInterval(() => {
      const at = now();
      let next = stateRef.current;
      // 탭이 오래 멈췄으면 밀린 단계를 한꺼번에 넘긴다.
      for (let step = 0; step < 32; step++) {
        const advanced = advanceMatch(next, at, newMatchId);
        if (advanced === next) break;
        next = advanced;
      }
      // 위젯으로 뜰 때만: 오래 기다리거나 오래 붙잡으면 방을 비워 순환으로 돌려보낸다.
      const active = isMatchActive(next);
      activeSince = active ? (activeSince ?? at) : null;
      const waiting = next.phase === "WAITING" && active;
      waitingSince = waiting ? (waitingSince ?? at) : null;
      const waitedTooLong =
        lobbyWaitMs !== undefined && waitingSince !== null && at - waitingSince >= lobbyWaitMs;
      const sessionTooLong =
        sessionLimitMs !== undefined &&
        activeSince !== null &&
        at - activeSince >= sessionLimitMs &&
        next.phase !== "PLAYING";
      if (waitedTooLong || sessionTooLong) {
        next = initialMatch(next.round + 1, newMatchId());
        activeSince = null;
        waitingSince = null;
      }
      commit(next);

      if (dirty) setState(stateRef.current);
      if (dirty || at - sentAt >= HEARTBEAT_MS) {
        dirty = false;
        sentAt = at;
        channel.send({ kind: "state", state: stateRef.current });
      }
      setClock(at);
    }, FRAME_MS);

    return () => {
      window.clearInterval(timer);
      unsubscribe();
      if (!injected) channel.close();
    };
  }, [roomId, injected, now, socketBase, token, lobbyWaitMs, sessionLimitMs]);

  return {
    state,
    now: clock,
    active: isMatchActive(state),
    status: socketBase && !token && !injected ? ("unauthorized" as const) : status,
  };
}
