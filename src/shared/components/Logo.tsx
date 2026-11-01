import { cn } from "@/shared/lib/utils";

/**
 * 브랜드 로고. 마크(핀 꽂은 전단)와 워드마크 "전단지"로 이루어진다.
 *
 * 마크는 게시판에 압정으로 꽂힌 전단 한 장이다. 강조색을 쓰는 유일한 브랜딩
 * 요소이며, 나머지 화면에서 빨강은 작업과 주의에만 쓴다.
 *
 * 마크의 도형은 `public/favicon.svg`와 같다. 한쪽을 고치면 다른 쪽도 고친다.
 */
interface LogoProps {
  size?: "sm" | "md" | "lg" | "tv";
  subtitle?: string | null;
  /** 좁은 화면에서는 마크만 보이고 이름은 보조기기에만 남긴다. 메뉴 자리를 번다. */
  compact?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { mark: "size-6", name: "text-[15px]", gap: "gap-2" },
  md: { mark: "size-[30px]", name: "text-[18px]", gap: "gap-2.5" },
  lg: { mark: "size-10", name: "text-[24px]", gap: "gap-3" },
  tv: { mark: "size-14", name: "text-[36px]", gap: "gap-4" },
} as const;

export function Logo({
  size = "md",
  subtitle = null,
  compact = false,
  className,
}: LogoProps) {
  const s = sizeMap[size];

  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <LogoMark className={cn("shrink-0", s.mark)} />
      <span
        className={cn(
          "font-extrabold tracking-tight text-ink",
          s.name,
          compact && "max-sm:sr-only",
        )}
      >
        전단지
      </span>
      {subtitle && (
        <span className="text-caption text-ink-subtle">{subtitle}</span>
      )}
    </span>
  );
}

/** 워드마크 없이 마크만. 옆에 서비스 이름이 함께 읽히므로 보조기기에는 숨긴다. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" className="fill-accent" />
      <g transform="rotate(-7 20 21)">
        <rect x="11.5" y="9" width="17" height="23" rx="2" className="fill-accent-on" />
        <rect x="15" y="17" width="10" height="2.4" rx="1.2" className="fill-accent" />
        <rect
          x="15"
          y="21.8"
          width="6.5"
          height="2.4"
          rx="1.2"
          className="fill-accent"
          opacity="0.4"
        />
      </g>
      <circle cx="18.6" cy="10.2" r="2.7" className="fill-brand-pin" />
    </svg>
  );
}
