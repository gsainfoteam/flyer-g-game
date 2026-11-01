/**
 * 서버 연결 id ↔ 참가자 id.
 *
 * 폰이 보내는 참가자 id는 폰이 정한 값이라 남의 id를 적을 수 있다. 서버가 붙인 연결 id에
 * 처음 쓴 참가자 id를 묶어 두고, 그 연결이 다른 id를 쓰거나 이미 다른 연결이 쓰는 id를
 * 쓰면 거절한다. 남을 내보내거나 남 대신 누를 수 없다.
 */
export function createPlayerBinding() {
  const playerOf = new Map<string, string>();
  const connectionOf = new Map<string, string>();

  return {
    /**
     * 이 연결이 이 참가자 id로 말해도 되는가. 처음이면 묶는다. 연결 id가 없으면(같은
     * 브라우저 탭끼리, 또는 채널이 대신 만든 메시지) 확인하지 않는다.
     */
    claim(from: string | undefined, playerId: string): boolean {
      if (from === undefined) return true;
      const bound = playerOf.get(from);
      if (bound !== undefined) return bound === playerId;
      if (connectionOf.has(playerId)) return false;
      playerOf.set(from, playerId);
      connectionOf.set(playerId, from);
      return true;
    },
    /** 연결이 끊겼을 때. 그 연결의 참가자 id를 풀어 돌려준다. 새 연결이 다시 쓸 수 있다. */
    release(from: string): string | null {
      const playerId = playerOf.get(from);
      if (playerId === undefined) return null;
      playerOf.delete(from);
      connectionOf.delete(playerId);
      return playerId;
    },
  };
}
