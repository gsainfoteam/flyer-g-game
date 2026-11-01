/**
 * 폰의 인포팀 로그인.
 *
 * 전단지에는 이미 인포팀 계정(account.gistory.me) 로그인이 있다(PKCE, 전단지 FE의
 * `features/auth`). 로그인 정보가 브라우저에 남아 있어 같은 폰이면 다음부터는 거의 바로
 * 지나간다. 이 시제품은 그 모듈을 들고 오지 않고, 같은 모양의 데모 로그인을 둔다.
 * 전단지로 옮기면 `createDemoPlayerAuth()` 자리에 전단지 로그인을 감싼 구현을 넣는다.
 */
export interface PlayerAuth {
  readonly demo: boolean;
  isSignedIn(): boolean;
  /** 로그인 화면으로 보냈다가 `returnTo`로 돌아온다. 데모는 바로 로그인된다. */
  signIn(returnTo: string): Promise<void>;
  getAccessToken(): Promise<string | null>;
  /** 데모 전용: 지금 로그인한 데모 사용자 id */
  demoUserId(): string | null;
}

/** 탭마다 다른 데모 사용자. 같은 브라우저에서 폰 두 대를 흉내 낼 수 있게 한다. */
const DEMO_USER_KEY = "flyerg:shuffleboard-demo-user";

export function createDemoPlayerAuth(): PlayerAuth {
  const read = () => {
    try {
      return window.sessionStorage.getItem(DEMO_USER_KEY);
    } catch {
      return null;
    }
  };
  return {
    demo: true,
    isSignedIn: () => read() !== null,
    async signIn() {
      try {
        if (!read()) window.sessionStorage.setItem(DEMO_USER_KEY, `demo-${crypto.randomUUID?.() ?? Date.now()}`);
      } catch {
        // 저장소를 못 쓰면 데모 로그인을 할 수 없다.
      }
    },
    getAccessToken: async () => read(),
    demoUserId: read,
  };
}
