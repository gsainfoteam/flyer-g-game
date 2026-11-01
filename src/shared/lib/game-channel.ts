/**
 * TV와 폰이 게임 메시지를 주고받는 통로. 게임 코드는 이 계약만 안다.
 *
 * 지금 구현은 같은 브라우저의 탭끼리만 통하는 `BroadcastChannel`이다. 개발 중에
 * TV 탭과 폰 탭을 나란히 열어 흐름을 확인하는 용도다. 실제 폰을 붙이려면 같은 계약으로
 * WebRTC나 외부 실시간 서비스 구현을 끼우면 된다. 브라우저끼리는 직접 소켓 서버를
 * 열 수 없어 중계 지점이 하나는 있어야 한다.
 */
export interface GameChannel<Incoming, Outgoing> {
  send(message: Outgoing): void;
  /**
   * 구독을 푸는 함수를 돌려준다. `from`은 보낸 연결의 id로, 서버 중계에서 서버가 정한다.
   * 보낸 쪽이 바꿀 수 없어 누가 보냈는지 믿을 수 있는 값이다. 같은 브라우저 탭끼리는 없다.
   */
  subscribe(listener: (message: Incoming, from?: string) => void): () => void;
  close(): void;
}

export function createBroadcastGameChannel<Incoming, Outgoing>(
  name: string,
): GameChannel<Incoming, Outgoing> {
  if (typeof BroadcastChannel === "undefined") {
    // 지원하지 않는 브라우저에서는 조용히 아무 일도 하지 않는다. 화면은 연결 끊김을 보여 준다.
    return { send() {}, subscribe: () => () => {}, close() {} };
  }
  const channel = new BroadcastChannel(`flyerg:game:${name}`);
  return {
    send(message) {
      channel.postMessage(message);
    },
    subscribe(listener) {
      const handle = (event: MessageEvent) => listener(event.data as Incoming);
      channel.addEventListener("message", handle);
      return () => channel.removeEventListener("message", handle);
    },
    close() {
      channel.close();
    },
  };
}
