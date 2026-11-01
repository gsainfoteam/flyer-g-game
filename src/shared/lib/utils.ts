import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * 커스텀 타입 스케일(`--text-*` 토큰)을 font-size 그룹으로 등록한다.
 *
 * 등록하지 않으면 tailwind-merge가 `text-overline` 같은 클래스를 글자색으로
 * 오분류해서, `text-ink` 같은 실제 색 클래스와 충돌한다고 보고 지워 버린다.
 * (StatusBadge에서 실제로 겪은 회귀)
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-overline",
        "text-caption",
        "text-label",
        "text-body",
        "text-subhead",
        "text-heading",
        "text-title",
        "text-display",
        "text-metric",
        "text-stat",
      ],
    },
  },
});

/** shadcn 컴포넌트와 앱 전체가 공유하는 단일 class 병합 utility. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
