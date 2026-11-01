import { to } from "@/shared/config/routes";

/** 폰 참가 주소. TV마다 QR은 하나다. 먼저 찍은 사람이 A팀, 다음 사람이 B팀이다. */
export function joinUrlOf(roomId: string): string {
  return `${window.location.origin}${to.playShuffleboard(roomId)}`;
}
