import type { Seat } from "@/entities/game/model/shuffleboard";
import { SHUFFLEBOARD_RULES } from "@/entities/game/model/shuffleboard-rules";
import { cn } from "@/shared/lib/utils";
import { SEAT_FILL } from "./seat-style";

/**
 * 폰 튜토리얼. 참가 화면과 상대를 기다리는 동안 보여 준다(기다리는 시간이 읽기 좋은 때다).
 *
 * 폰에는 보드가 없어서, 처음 하는 사람은 "어떻게 던지고 어디를 노리는지"를 여기서 안다.
 * 그림 하나와 세 줄로 끝낸다. 길게 쓰면 읽지 않는다.
 */
export function HowToPlay({ seat, className }: { seat: Seat; className?: string }) {
  return (
    <section aria-labelledby="how-to-play" className={cn("rounded-card bg-surface px-5 py-5", className)}>
      <h2 id="how-to-play" className="text-heading text-ink">
        이렇게 던져요
      </h2>
      <div className="mt-4 flex items-center gap-5">
        <SlingshotPicture seat={seat} />
        <ol className="flex min-w-0 flex-1 flex-col gap-3 text-body text-ink">
          <li>
            <strong className="font-bold">원반을 아래로 당겨요.</strong> 많이 당길수록 멀리 가요.
          </li>
          <li>
            <strong className="font-bold">당긴 반대쪽으로 날아가요.</strong> 손을 떼면 던져요.
          </li>
          <li>
            <strong className="font-bold">TV를 보고 던지세요.</strong> 끝의 초록 칸이 10점, 넘어가면 0점이에요.
          </li>
        </ol>
      </div>
      <p className="mt-4 text-label text-ink-muted">
        번갈아 {SHUFFLEBOARD_RULES.shotsPerSeat}번씩, 한 번에 {SHUFFLEBOARD_RULES.turnMs / 1000}초 안에
        던져요. 끝났을 때 보드에 남은 원반으로 점수를 매겨서, 상대 원반을 밀어낼 수도 있어요.
      </p>
    </section>
  );
}

/** 당기기(아래 화살표)와 날아가는 방향(위 점선)을 한 그림에 */
function SlingshotPicture({ seat }: { seat: Seat }) {
  const fill = SEAT_FILL[seat];
  return (
    <svg
      viewBox="0 0 80 120"
      className="h-28 w-[76px] shrink-0"
      role="img"
      aria-label="원반을 아래로 당기면 위로 날아가요"
    >
      {/* 날아가는 방향 */}
      <line x1="40" y1="44" x2="40" y2="8" stroke={fill} strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
      <path d="M33 14 L40 4 L47 14" fill="none" stroke={fill} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* 처음 자리 */}
      <circle cx="40" cy="52" r="13" fill="none" stroke="var(--color-line-strong)" strokeWidth="2" strokeDasharray="4 4" />
      {/* 당긴 원반 */}
      <circle cx="40" cy="86" r="14" fill={fill} stroke="var(--color-surface)" strokeWidth="3" />
      <circle cx="40" cy="86" r="6" fill="var(--color-surface)" fillOpacity="0.35" />
      {/* 당기는 방향 */}
      <path d="M40 104 L40 116 M34 110 L40 116 L46 110" fill="none" stroke="var(--color-ink-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
