import { describe, expect, it } from "vitest";
import { createPlayerBinding } from "./player-binding";

describe("createPlayerBinding", () => {
  it("연결은 처음 쓴 참가자 id로만 말할 수 있다", () => {
    const binding = createPlayerBinding();
    expect(binding.claim("c1", "p1")).toBe(true);
    expect(binding.claim("c1", "p1")).toBe(true);
    expect(binding.claim("c1", "p2")).toBe(false);
  });

  it("다른 연결이 쓰는 참가자 id는 쓸 수 없다", () => {
    const binding = createPlayerBinding();
    binding.claim("victim", "p1");
    expect(binding.claim("attacker", "p1")).toBe(false);
  });

  it("끊긴 연결의 참가자 id는 새 연결이 다시 쓸 수 있다", () => {
    const binding = createPlayerBinding();
    binding.claim("c1", "p1");
    expect(binding.claim("c2", "p1")).toBe(false);
    expect(binding.release("c1")).toBe("p1");
    expect(binding.claim(undefined, "p1")).toBe(true);
    expect(binding.claim("c2", "p1")).toBe(true);
    expect(binding.release("unknown")).toBeNull();
  });
});
