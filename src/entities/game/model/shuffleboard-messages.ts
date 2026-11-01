import { SHUFFLEBOARD_RULES } from "./shuffleboard-rules";
import type { MatchClientMessage } from "./shuffleboard";

/**
 * 폰이 보낸 메시지를 믿지 않고 읽는다. 폰은 로그인하지 않으므로 누구나 아무 값이나
 * 보낼 수 있다. 모양이 틀리면 null이고, TV는 그 메시지를 버린다.
 * 각도·힘의 범위는 물리 쪽(`clampShot`)이 다시 자른다.
 */
const ID_MAX_LENGTH = 64;
/** sha-256 hex */
const CLAIM_HASH = /^[0-9a-f]{64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readId = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= ID_MAX_LENGTH
    ? value
    : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function parseClientMessage(raw: unknown): MatchClientMessage | null {
  if (!isRecord(raw)) return null;
  const playerId = readId(raw.playerId);
  if (!playerId) return null;

  switch (raw.kind) {
    case "hello":
    case "leave":
      return { kind: raw.kind, playerId };
    case "join": {
      if (typeof raw.name !== "string") return null;
      const claimHash =
        typeof raw.claimHash === "string" && CLAIM_HASH.test(raw.claimHash)
          ? raw.claimHash
          : null;
      return {
        kind: "join",
        playerId,
        // 엔진이 정리하기 전에 터무니없이 긴 값은 미리 자른다.
        name: raw.name.slice(0, SHUFFLEBOARD_RULES.nameMaxLength * 4),
        claimHash,
      };
    }
    case "shoot": {
      const turn = readNumber(raw.turn);
      const angle = readNumber(raw.angle);
      const power = readNumber(raw.power);
      if (turn === null || angle === null || power === null || !Number.isInteger(turn)) {
        return null;
      }
      return { kind: "shoot", playerId, turn, angle, power };
    }
    default:
      return null;
  }
}
