import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/*
 * shadcn 생성본에서 수정한 부분: variant와 size를 제품 디자인에 맞췄다.
 *
 * 주 작업은 브랜드 강조색 채움이다. destructive도 같은 빨강을 쓴다 — 이 체계에서
 * 빨강은 "지금 하는 작업"을 뜻하고, 위험은 문구와 확인 dialog가 알린다.
 * 나머지는 중성 채움과 경계선이다. 크기는 한국어 문구가 들어가는 실제 버튼에
 * 맞췄다.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-on hover:bg-accent-600 active:bg-accent-700",
        destructive:
          "bg-accent text-accent-on hover:bg-accent-600 active:bg-accent-700",
        secondary:
          "bg-surface-muted text-ink hover:bg-line active:bg-line-strong",
        outline:
          "border-line-strong bg-surface text-ink hover:bg-surface-muted",
        ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
        link: "text-ink-muted underline-offset-4 hover:text-ink hover:underline",
      },
      size: {
        default: "h-10 px-5 text-[15px]",
        sm: "h-9 px-4 text-[14px]",
        xs: "h-8 px-3 text-[13px]",
        lg: "h-12 px-6 text-[16px]",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-xs": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      // form 안의 보조 버튼이 의도치 않게 제출하지 않도록 기본값을 button으로 둔다.
      // 제출 버튼은 type="submit"을 명시한다. asChild면 자식 요소의 속성을 따른다.
      type={asChild ? undefined : "button"}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
