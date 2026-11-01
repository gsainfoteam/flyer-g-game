/**
 * 앱의 경로를 한곳에서 만든다. 화면에서 문자열을 직접 조립하지 않는다.
 * 전단지(flyer-g-fe)의 `routes.ts`와 같은 모양이다. 옮길 때 아래 셔플보드 줄만
 * 그쪽 `paths`·`to`에 더하면 된다.
 */
export const paths = {
  home: "/",
  /** TV 게임 화면. `:roomId`는 전단지에서는 기기 id, 이 시제품에서는 `old`/`new`다. */
  shuffleboard: "/games/shuffleboard/:roomId",
  /** 폰 참여 화면. 로그인 없이 TV의 QR 하나로 들어온다. */
  playShuffleboard: "/play/shuffleboard/:roomId",
} as const;

export const to = {
  home: () => "/",
  shuffleboard: (roomId: string) => `/games/shuffleboard/${encodeURIComponent(roomId)}`,
  playShuffleboard: (roomId: string) =>
    `/play/shuffleboard/${encodeURIComponent(roomId)}`,
};
