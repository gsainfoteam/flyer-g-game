/**
 * 게임 중계 서버 주소(`wss://<api>/games/ws`). 전단지 백엔드의 중계(`games` 모듈)를
 * 그대로 쓴다. 비워 두면 같은 브라우저 탭끼리만 잇는다(개발용).
 *
 * 전단지에서는 `@/features/click-battle/api/game-socket`의 `gameSocketBase()`를
 * 그대로 쓰면 되므로 이 파일은 옮기지 않는다.
 */
export function gameSocketBase(): string | null {
  const url = import.meta.env.VITE_GAME_SOCKET_URL as string | undefined;
  if (!url) return null;
  // 폰 테스트 서버(`bun run play:lan`)처럼 앱과 중계가 같은 주소에 있을 때
  if (url === "same-origin") {
    const origin = new URL("/games/ws", window.location.href);
    origin.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
    return origin.toString();
  }
  return url;
}
