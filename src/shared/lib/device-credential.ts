/**
 * TV 기기 토큰 (`API-CHANGES-BACKEND.md` 8절 "기기 자격 증명").
 *
 * 관리자가 기기를 등록·재발급하면 토큰을 한 번만 받는다. 그 토큰으로 설정 링크
 * `https://<프론트>/display/{id}#token={token}`을 만들어 TV에서 한 번 연다.
 *
 * - `#` 뒤는 서버로 전송되지 않아 서버 로그에 남지 않는다. 토큰을 query로 받지 않는다.
 * - 받자마자 기기에 저장하고 주소창에서 지운다. 화면을 찍어도 토큰이 보이지 않게.
 * - 이후 요청에는 `X-Device-Token` 헤더로 싣는다.
 *
 * TV는 기기 전용 브라우저라 창을 닫아도 남도록 localStorage에 둔다. 기기마다 따로
 * 저장해 한 브라우저에서 여러 기기를 시험해도 섞이지 않게 한다.
 */
const KEY_PREFIX = "flyerg:device-token:";
const HASH_PARAM = "token";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export interface DeviceCredentials {
  get(deviceId: string): string | null;
  save(deviceId: string, token: string): void;
  clear(deviceId: string): void;
}

export function createDeviceCredentials(
  storage: StorageLike | null = defaultStorage(),
): DeviceCredentials {
  const memory = new Map<string, string>();
  const key = (deviceId: string) => `${KEY_PREFIX}${deviceId}`;
  return {
    get(deviceId) {
      try {
        return storage?.getItem(key(deviceId)) ?? memory.get(deviceId) ?? null;
      } catch {
        return memory.get(deviceId) ?? null;
      }
    },
    save(deviceId, token) {
      memory.set(deviceId, token);
      try {
        storage?.setItem(key(deviceId), token);
      } catch {
        // 저장소가 막혀도 이번 창에서는 메모리 사본으로 동작한다.
      }
    },
    clear(deviceId) {
      memory.delete(deviceId);
      try {
        storage?.removeItem(key(deviceId));
      } catch {
        // 지우지 못해도 다음 저장이 덮어쓴다.
      }
    },
  };
}

/** 앱 전체가 함께 쓰는 기기 토큰 저장소 */
export const deviceCredentials = createDeviceCredentials();

/**
 * 설정 링크의 `#token=`을 저장하고 주소에서 지운다. 저장했으면 true.
 * 편성을 부르기 전에(첫 렌더링에서) 불러야 첫 요청부터 토큰이 실린다.
 */
export function captureDeviceTokenFromUrl(
  deviceId: string,
  credentials: DeviceCredentials = deviceCredentials,
  location: Pick<Location, "hash" | "pathname" | "search"> = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
): boolean {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get(HASH_PARAM)?.trim();
  if (!token) return false;

  credentials.save(deviceId, token);
  params.delete(HASH_PARAM);
  const rest = params.toString();
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${location.search}${rest ? `#${rest}` : ""}`,
  );
  return true;
}
