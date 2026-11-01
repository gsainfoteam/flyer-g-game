import type { GameChannel } from "./game-channel";

/**
 * 백엔드 게임 중계(`/games/ws`)를 거치는 `GameChannel`.
 *
 * 모든 메시지가 서버를 지나므로 학교 와이파이·LTE에서도 일반 https(443)로 붙는다.
 * 서버는 게임을 모르고 옮기기만 한다. 참가자 메시지는 TV에게, TV 메시지는 방의
 * 모든 참가자에게 간다.
 *
 * - TV(호스트)는 연결 뒤 첫 메시지로 기기 토큰을 보낸다. URL에 싣지 않는다.
 * - 끊기면 점점 길게 기다리며 다시 붙는다. 토큰이 틀렸거나 다른 탭이 같은 기기로
 *   붙어 밀려났으면 다시 붙지 않는다. 두 TV가 서로를 계속 밀어내지 않게.
 */
export type GameLinkStatus =
  /** 서버에 붙는 중 */
  | "connecting"
  /** 붙었다. 참가자는 TV도 켜져 있다. */
  | "open"
  /** 참가자만. 서버에는 붙었지만 TV가 아직 없다. */
  | "waiting-host"
  /** 끊겨서 다시 붙는 중 */
  | "reconnecting"
  /** TV만. 기기 토큰이 없거나 틀렸다. 다시 붙지 않는다. */
  | "unauthorized"
  /** TV만. 같은 기기의 다른 화면이 연결을 가져갔다. */
  | "replaced";

/** 서버 종료 코드. 백엔드 `game-relay.ts`의 RELAY_CLOSE와 같다. */
const CLOSE = {
  unauthorized: 4001,
  forbidden: 4003,
  roomFull: 4009,
  replaced: 4010,
} as const;

const RETRY_MS = { first: 1_000, max: 15_000 } as const;
/** 연결 전에 쌓아 둘 메시지 수. 오래 못 붙으면 오래된 것부터 버린다. */
const MAX_QUEUE = 50;

interface Options {
  onStatus?: (status: GameLinkStatus) => void;
}

export interface WsHostOptions<Incoming> extends Options {
  token: string;
  /**
   * 참가자 연결이 끊겼을 때 대신 받을 메시지. 끊긴 연결의 id를 준다.
   * 탭을 닫아 "나간다"를 못 보낸 폰도 명단에서 빼려는 것이다.
   */
  onDisconnect?: (from: string) => Incoming | null;
}

function socketUrl(base: string, room: string, role: "host" | "player"): string {
  const url = new URL(base);
  url.searchParams.set("room", room);
  url.searchParams.set("role", role);
  return url.toString();
}

function parse(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") return null;
  try {
    const value: unknown = JSON.parse(data);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** 다시 붙기를 맡는 공통 뼈대. 연결마다 `setup`이 핸들러를 단다. */
function reconnecting(
  url: string,
  onStatus: ((status: GameLinkStatus) => void) | undefined,
  setup: (socket: WebSocket) => void,
  /** 이 종료 코드면 다시 붙지 않는다. 그때 알릴 상태를 돌려준다. */
  finalStatus: (code: number) => GameLinkStatus | null,
) {
  let socket: WebSocket | null = null;
  let closed = false;
  let retryMs: number = RETRY_MS.first;
  let timer: number | undefined;

  const open = () => {
    if (closed) return;
    onStatus?.(retryMs === RETRY_MS.first ? "connecting" : "reconnecting");
    const next = new WebSocket(url);
    socket = next;
    next.addEventListener("open", () => {
      retryMs = RETRY_MS.first;
    });
    next.addEventListener("close", (event) => {
      if (closed || socket !== next) return;
      const final = finalStatus(event.code);
      if (final) {
        // 화면에는 상태만 보인다. 원인을 찾을 수 있게 서버가 준 코드와 이유를 남긴다.
        console.warn(`[game] 연결 종료 ${event.code} ${event.reason}`);
        onStatus?.(final);
        return;
      }
      onStatus?.("reconnecting");
      timer = window.setTimeout(open, retryMs);
      retryMs = Math.min(RETRY_MS.max, retryMs * 2);
    });
    setup(next);
  };
  open();

  return {
    current: () => socket,
    close() {
      closed = true;
      window.clearTimeout(timer);
      socket?.close(1000, "Closed by client");
    },
  };
}

export function createWsHostChannel<Incoming, Outgoing>(
  baseUrl: string,
  room: string,
  options: WsHostOptions<Incoming>,
): GameChannel<Incoming, Outgoing> {
  const listeners = new Set<(message: Incoming, from?: string) => void>();
  let ready = false;

  const emit = (message: Incoming, from?: string) =>
    listeners.forEach((listener) => listener(message, from));

  const link = reconnecting(
    socketUrl(baseUrl, room, "host"),
    options.onStatus,
    (socket) => {
      ready = false;
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ type: "auth", token: options.token }));
      });
      socket.addEventListener("message", (event) => {
        const frame = parse(event.data);
        if (!frame) return;
        if (frame.type === "ready") {
          ready = true;
          options.onStatus?.("open");
        } else if (frame.type === "message" && typeof frame.from === "string") {
          emit(frame.data as Incoming, frame.from);
        } else if (frame.type === "left" && typeof frame.from === "string") {
          // 대신 만든 메시지는 이 채널이 만든 것이라 보낸 연결이 없다. 연결 id를 붙이면
          // 받는 쪽이 끊긴 연결에 참가자를 다시 묶는다.
          const replacement = options.onDisconnect?.(frame.from);
          if (replacement) emit(replacement);
        }
      });
    },
    (code) =>
      code === CLOSE.unauthorized || code === CLOSE.forbidden
        ? "unauthorized"
        : code === CLOSE.replaced
          ? "replaced"
          : null,
  );

  return {
    send(message) {
      const socket = link.current();
      if (ready && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "send", data: message }));
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: link.close,
  };
}

export function createWsClientChannel<Incoming, Outgoing>(
  baseUrl: string,
  room: string,
  options: Options = {},
): GameChannel<Incoming, Outgoing> {
  const listeners = new Set<(message: Incoming) => void>();
  let queue: Outgoing[] = [];

  const link = reconnecting(
    socketUrl(baseUrl, room, "player"),
    options.onStatus,
    (socket) => {
      socket.addEventListener("open", () => {
        const pending = queue;
        queue = [];
        pending.forEach((message) =>
          socket.send(JSON.stringify({ type: "send", data: message })),
        );
      });
      socket.addEventListener("message", (event) => {
        const frame = parse(event.data);
        if (!frame) return;
        if (frame.type === "host") {
          options.onStatus?.(frame.online ? "open" : "waiting-host");
        } else if (frame.type === "message") {
          listeners.forEach((listener) => listener(frame.data as Incoming));
        }
      });
    },
    // 방이 찼으면 다시 붙어도 소용없다. 화면은 연결 대기로 남는다.
    (code) => (code === CLOSE.roomFull ? "waiting-host" : null),
  );

  return {
    send(message) {
      const socket = link.current();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "send", data: message }));
      } else {
        queue.push(message);
        if (queue.length > MAX_QUEUE) queue.shift();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      // 마지막 메시지("나간다")가 나갈 틈을 두고 끊는다.
      window.setTimeout(link.close, 200);
    },
  };
}
