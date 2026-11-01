import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import {
  QR_QUIET_ZONE_MODULES,
  QrEncodeError,
  encodeQrMatrix,
  qrViewBoxSize,
  toQrPathData,
} from "./qr";
import type { QrMatrix } from "./qr";

const MODULE_PX = 4;

/**
 * 모듈 행렬을 실제 스캐너가 보는 것과 같은 픽셀로 펼친다.
 * quiet zone을 넣지 않으면 디코더가 코드 경계를 찾지 못한다.
 */
function toImageData(matrix: QrMatrix): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const side = qrViewBoxSize(matrix) * MODULE_PX;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);

  for (let row = 0; row < matrix.moduleCount; row++) {
    for (let col = 0; col < matrix.moduleCount; col++) {
      if (!matrix.modules[row]![col]) continue;
      const originX = (col + QR_QUIET_ZONE_MODULES) * MODULE_PX;
      const originY = (row + QR_QUIET_ZONE_MODULES) * MODULE_PX;
      for (let y = originY; y < originY + MODULE_PX; y++) {
        for (let x = originX; x < originX + MODULE_PX; x++) {
          const offset = (y * side + x) * 4;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        }
      }
    }
  }

  return { data, width: side, height: side };
}

function decode(value: string): string | null {
  const image = toImageData(encodeQrMatrix(value));
  return jsQR(image.data, image.width, image.height)?.data ?? null;
}

describe("encodeQrMatrix", () => {
  it("실제 QR 디코더가 원래 URL을 읽는다", () => {
    const url = "https://ziggle.gistory.me/notice/12345";
    expect(decode(url)).toBe(url);
  });

  it("긴 URL도 버전을 키워 인코딩한다", () => {
    const url = `https://ziggle.gistory.me/notice/12345?utm_source=${"a".repeat(120)}`;
    expect(decode(url)).toBe(url);
  });

  it("오류 정정 수준이 달라도 같은 값을 읽는다", () => {
    const url = "https://ziggle.gistory.me/notice/7";
    const image = toImageData(encodeQrMatrix(url, "H"));
    expect(jsQR(image.data, image.width, image.height)?.data).toBe(url);
  });

  it("빈 값은 조용히 통과하지 않는다", () => {
    expect(() => encodeQrMatrix("")).toThrow(QrEncodeError);
  });

  it("모듈 수는 버전 규격(4n+17)을 따른다", () => {
    const { moduleCount } = encodeQrMatrix("https://ziggle.gistory.me");
    expect((moduleCount - 17) % 4).toBe(0);
  });
});

describe("toQrPathData", () => {
  it("가로로 이어진 모듈을 사각형 하나로 합친다", () => {
    const matrix: QrMatrix = {
      moduleCount: 2,
      modules: [
        [true, true],
        [false, true],
      ],
    };
    expect(toQrPathData(matrix, 0)).toBe("M0 0h2v1h-2zM1 1h1v1h-1z");
  });

  it("quiet zone만큼 평행이동한다", () => {
    const matrix: QrMatrix = { moduleCount: 1, modules: [[true]] };
    expect(toQrPathData(matrix, 4)).toBe("M4 4h1v1h-1z");
  });

  it("어두운 모듈이 없으면 빈 path다", () => {
    const matrix: QrMatrix = { moduleCount: 1, modules: [[false]] };
    expect(toQrPathData(matrix, 4)).toBe("");
  });
});

describe("qrViewBoxSize", () => {
  it("양쪽 quiet zone을 포함한다", () => {
    const matrix: QrMatrix = { moduleCount: 21, modules: [] };
    expect(qrViewBoxSize(matrix, 4)).toBe(29);
  });
});
