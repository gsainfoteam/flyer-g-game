import { createContext } from "react";
import type { ReactNode } from "react";

/**
 * TV 머리 줄 시계 옆에 늘 띄울 것(날씨 등). 포스터 화면과 위젯 화면이 모두 같은 머리
 * 줄을 쓰므로 화면마다 넘기지 않고 플레이어가 한 번 넣는다. 없으면 시계만 나온다.
 */
export const StageAmbientContext = createContext<ReactNode>(null);
