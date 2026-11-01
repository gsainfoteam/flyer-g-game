import type { Seat } from "@/entities/game/model/shuffleboard";

/** 팀 색. 클릭 배틀과 같이 A팀은 강조색(빨강), B팀은 정보색(파랑)이다. */
export const SEAT_FILL: Record<Seat, string> = {
  A: "var(--color-accent)",
  B: "var(--color-info)",
};

export const SEAT_TEXT: Record<Seat, string> = {
  A: "text-accent",
  B: "text-info",
};

export const SEAT_DOT: Record<Seat, string> = { A: "bg-accent", B: "bg-info" };
