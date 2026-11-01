import { Outlet } from "react-router";
import { Logo } from "@/shared/components/Logo";

/**
 * 폰 참여 화면 셸. 전단지 `PlayLayout`과 같다. TV의 QR로 들어온 학생이 로그인 없이 쓴다.
 */
export function PlayLayout() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pt-4 pb-8">
        <header className="flex h-12 items-center">
          <Logo size="md" />
        </header>
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
