import "@testing-library/jest-dom/vitest";

/**
 * 테스트는 실제 시간에 의존하지 않는다. 명세 17장 완료 정의.
 * 개별 테스트가 필요하면 `vi.setSystemTime`으로 이 기준 시각을 옮긴다.
 */
export const TEST_NOW = new Date("2026-06-08T03:00:00.000Z");

/**
 * jsdom에 없는 DOM API. Radix Select/Dialog가 호출한다.
 * 없으면 클릭 시 TypeError로 조용히 실패해 테스트가 원인 불명으로 깨진다.
 */
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
