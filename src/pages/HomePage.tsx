import { Link } from "react-router";
import { to } from "@/shared/config/routes";
import { VENUES, VENUE_LABEL } from "@/shared/config/venue";

/**
 * 시제품 첫 화면. TV와 폰 화면으로 가는 길만 둔다. 전단지로 옮길 때는 쓰지 않는다.
 *
 * 서버 중계 주소(`VITE_GAME_SOCKET_URL`)가 없으면 같은 브라우저의 탭끼리만 이어진다.
 * TV 탭 하나와 폰 탭 두 개를 나란히 열어 한 판을 해 볼 수 있다.
 */
export function HomePage() {
  return (
    <div className="flex flex-1 flex-col gap-8 pt-4">
      <div>
        <h1 className="text-title text-ink">전단지 셔플보드 대항전</h1>
        <p className="mt-2 text-body text-ink-muted">
          TV 화면을 하나 열고, 폰 화면을 탭 두 개로 열면 한 경기를 해 볼 수 있어요.
          먼저 연 폰이 A팀이에요.
        </p>
      </div>
      {VENUES.map((venue) => (
        <section key={venue} className="flex flex-col gap-3 rounded-card bg-surface px-5 py-5">
          <h2 className="text-heading text-ink">{VENUE_LABEL[venue]} 로비</h2>
          <Link className="text-subhead text-accent underline-offset-4 hover:underline" to={to.shuffleboard(venue)}>
            TV 화면 열기
          </Link>
          <Link className="text-subhead text-accent underline-offset-4 hover:underline" to={to.playShuffleboard(venue)}>
            폰 참가 화면 열기
          </Link>
        </section>
      ))}
    </div>
  );
}
