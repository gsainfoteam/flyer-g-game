/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 전단지 백엔드 게임 중계 주소(wss://…/games/ws). 비우면 같은 브라우저 탭끼리 잇는다. */
  readonly VITE_GAME_SOCKET_URL?: string;
}
