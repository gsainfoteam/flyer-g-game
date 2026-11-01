/**
 * TV가 놓인 장소(구관/신관). 구관과 신관 TV는 각자 독립된 방이다.
 * 경기 안의 두 사람(A팀/B팀)과는 다른 개념이다.
 */
export const VENUES = ["old", "new"] as const;
export type Venue = (typeof VENUES)[number];

export const VENUE_LABEL: Record<Venue, string> = {
  old: "구관",
  new: "신관",
};

const isVenue = (value: string): value is Venue =>
  (VENUES as readonly string[]).includes(value);

/**
 * 방 id로 장소를 정한다.
 *
 * 시제품에서는 방 id가 곧 장소(`old`/`new`)다. 전단지에서는 방 id가 TV 기기 id이므로,
 * 옮길 때 이 함수만 "기기 설정의 장소 값"을 읽도록 바꾼다.
 */
export function venueOfRoom(roomId: string): Venue | null {
  return isVenue(roomId) ? roomId : null;
}
