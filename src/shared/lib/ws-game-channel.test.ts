import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWsClientChannel, createWsHostChannel } from "./ws-game-channel";
import type { GameLinkStatus } from "./ws-game-channel";

/** 브라우저 WebSocket 흉내. 서버 쪽 동작은 테스트가 직접 일으킨다. */
class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  url: string;
  constructor(url: string) {
    super();
    this.url = url;
    FakeSocket.instances.push(this);
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.readyState = 3;
  }
  serverOpen() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }
  serverSend(frame: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(frame) }));
  }
  serverClose(code: number) {
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent("close", { code }));
  }
}

const BASE = "wss://api.example.com/games/ws";
const last = () => FakeSocket.instances.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createWsHostChannel", () => {
  it("방과 역할을 주소에 싣고, 열리면 기기 토큰으로 인증한다", () => {
    const statuses: GameLinkStatus[] = [];
    createWsHostChannel(BASE, "device-1", {
      token: "fgd_secret",
      onStatus: (status) => statuses.push(status),
    });
    const socket = last();
    expect(socket.url).toBe(`${BASE}?room=device-1&role=host`);
    expect(socket.url).not.toContain("fgd_");

    socket.serverOpen();
    expect(socket.sent).toEqual([{ type: "auth", token: "fgd_secret" }]);
    socket.serverSend({ type: "ready" });
    expect(statuses.at(-1)).toBe("open");
  });

  it("인증 전에는 보내지 않고, 인증 뒤에는 send로 감싸 보낸다", () => {
    const channel = createWsHostChannel<unknown, { kind: string }>(BASE, "d", { token: "t" });
    const socket = last();
    socket.serverOpen();
    channel.send({ kind: "state" });
    expect(socket.sent).toHaveLength(1);
    socket.serverSend({ type: "ready" });
    channel.send({ kind: "state" });
    expect(socket.sent.at(-1)).toEqual({ type: "send", data: { kind: "state" } });
  });

  it("보낸 연결의 id를 함께 넘기고, 연결이 끊기면 대신 내보낸다", () => {
    type Message = { kind: string; playerId: string };
    const received: [Message, string | undefined][] = [];
    const channel = createWsHostChannel<Message, unknown>(BASE, "d", {
      token: "t",
      onDisconnect: (from) => (from === "c1" ? { kind: "leave", playerId: "p1" } : null),
    });
    channel.subscribe((message, from) => received.push([message, from]));
    const socket = last();
    socket.serverOpen();
    socket.serverSend({ type: "ready" });
    socket.serverSend({ type: "message", from: "c1", data: { kind: "join", playerId: "p1" } });
    socket.serverSend({ type: "left", from: "c1" });
    socket.serverSend({ type: "left", from: "unknown" });
    expect(received).toEqual([
      [{ kind: "join", playerId: "p1" }, "c1"],
      // 대신 만든 메시지는 끊긴 연결에 다시 묶이지 않게 연결 id 없이 온다.
      [{ kind: "leave", playerId: "p1" }, undefined],
    ]);
  });

  it("끊기면 다시 붙지만, 인증 실패나 밀려남이면 멈춘다", () => {
    const statuses: GameLinkStatus[] = [];
    createWsHostChannel(BASE, "d", { token: "t", onStatus: (status) => statuses.push(status) });
    last().serverClose(1006);
    expect(statuses.at(-1)).toBe("reconnecting");
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);

    last().serverClose(4010);
    expect(statuses.at(-1)).toBe("replaced");
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});

describe("createWsClientChannel", () => {
  it("열리기 전 메시지를 쌓았다가 보내고, TV 유무를 알린다", () => {
    const statuses: GameLinkStatus[] = [];
    const received: unknown[] = [];
    const channel = createWsClientChannel<unknown, { kind: string }>(BASE, "d", {
      onStatus: (status) => statuses.push(status),
    });
    channel.subscribe((message) => received.push(message));
    const socket = last();
    expect(socket.url).toBe(`${BASE}?room=d&role=player`);

    channel.send({ kind: "hello" });
    expect(socket.sent).toEqual([]);
    socket.serverOpen();
    expect(socket.sent).toEqual([{ type: "send", data: { kind: "hello" } }]);

    socket.serverSend({ type: "host", online: false });
    expect(statuses.at(-1)).toBe("waiting-host");
    socket.serverSend({ type: "host", online: true });
    expect(statuses.at(-1)).toBe("open");
    socket.serverSend({ type: "message", data: { kind: "state" } });
    expect(received).toEqual([{ kind: "state" }]);
  });

  it("끊기면 점점 길게 기다리며 다시 붙는다", () => {
    createWsClientChannel(BASE, "d");
    last().serverClose(1006);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    last().serverClose(1006);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(3);
  });
});
