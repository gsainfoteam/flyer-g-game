/**
 * 기록 소유 증명값.
 *
 * 경기 전에는 로그인하지 않는다(명세 3장). 대신 폰이 비밀값을 하나 만들어 혼자
 * 간직하고, TV에는 그 해시만 보낸다. TV 상태는 방의 모든 폰에 보이므로 비밀값을
 * 보내면 남이 가로챌 수 있다. 경기 뒤 로그인한 폰이 서버에 비밀값을 내면, 서버는
 * 해시를 대조해 "이 기록의 주인"임을 확인한다. (명세 7.2)
 */
export interface Claim {
  secret: string;
  /** sha-256 hex. 보안 연결(https, localhost)이 아니면 만들 수 없어 null */
  hash: string | null;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export async function createClaim(): Promise<Claim> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const secret = toHex(random);
  if (!crypto.subtle) return { secret, hash: null };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return { secret, hash: toHex(new Uint8Array(digest)) };
}
