import { createDemoServer } from "@/entities/game/api/demo-server";
import { createHttpShuffleboardApi } from "@/entities/game/api/http-client";
import type { ShuffleboardApi } from "@/entities/game/api/contract";
import { createDemoPlayerAuth } from "./player-auth";
import type { PlayerAuth } from "./player-auth";

/**
 * 이 앱이 쓰는 로그인과 서버.
 *
 * `VITE_API_BASE_URL`이 있으면 실제 서버(전단지 백엔드)에 붙는다. 이때 로그인은 전단지
 * 로그인을 넣어야 하므로, 이 시제품에서는 서버 주소가 있어도 데모 로그인 토큰으로는
 * 통과하지 못한다. 서버 주소가 없으면 데모 서버(이 브라우저 안)로 돈다.
 */
export const playerAuth: PlayerAuth = createDemoPlayerAuth();

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const shuffleboardApi: ShuffleboardApi = apiBaseUrl
  ? createHttpShuffleboardApi(apiBaseUrl, () => playerAuth.getAccessToken())
  : createDemoServer(() => playerAuth.demoUserId());

/** 랭킹 읽기. 함수 하나를 계속 넘겨 effect가 되풀이되지 않게 모듈에 둔다. */
export const loadRanking = () => shuffleboardApi.ranking();
