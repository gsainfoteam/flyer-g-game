import type { Seat } from "@/entities/game/model/shuffleboard";
import { to } from "@/shared/config/routes";

/** 폰 참가 주소. TV마다 팀별 QR이 하나씩(A팀, B팀) 있다. */
export function joinUrlOf(roomId: string, seat: Seat): string {
  return `${window.location.origin}${to.playShuffleboard(roomId, seat)}`;
}
