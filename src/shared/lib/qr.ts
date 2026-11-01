import qrcode from "qrcode-generator";

/**
 * QR 인코딩.
 *
 * 실제 스캔되는 QR을 만든다. 값의 단일 원천은 신청의 `detailUrl`이며(명세 FR-PLY-05),
 * QR 이미지를 서버에 저장하지 않고 그리는 쪽에서 생성한다.
 *
 * 오류 정정 수준은 M이다. TV는 2~5m 거리에서 읽히므로 모듈이 촘촘해지는 H보다
 * 모듈 하나가 큰 쪽이 유리하고, 화면은 인쇄물과 달리 오염·훼손이 없다.
 */
export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export const DEFAULT_QR_ERROR_CORRECTION: QrErrorCorrectionLevel = "M";

export interface QrMatrix {
  /** 한 변의 모듈 수. 여백(quiet zone)은 포함하지 않는다. */
  moduleCount: number;
  /** [row][col]. true면 어두운 모듈. */
  modules: boolean[][];
}

export class QrEncodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "QrEncodeError";
  }
}

/**
 * 문자열을 QR 모듈 행렬로 바꾼다.
 *
 * type number 0은 내용 길이에 맞는 최소 버전을 고르게 한다. 버전을 고정하면
 * 긴 URL에서 조용히 실패한다.
 */
export function encodeQrMatrix(
  value: string,
  errorCorrectionLevel: QrErrorCorrectionLevel = DEFAULT_QR_ERROR_CORRECTION,
): QrMatrix {
  if (value.length === 0) {
    throw new QrEncodeError("QR로 만들 값이 비어 있습니다.");
  }

  let qr: ReturnType<typeof qrcode>;
  try {
    qr = qrcode(0, errorCorrectionLevel);
    qr.addData(value);
    qr.make();
  } catch (cause) {
    throw new QrEncodeError(
      "QR을 만들 수 없습니다. 값이 너무 길 수 있습니다.",
      { cause },
    );
  }

  const moduleCount = qr.getModuleCount();
  const modules: boolean[][] = [];
  for (let row = 0; row < moduleCount; row++) {
    const cells: boolean[] = [];
    for (let col = 0; col < moduleCount; col++) {
      cells.push(qr.isDark(row, col));
    }
    modules.push(cells);
  }

  return { moduleCount, modules };
}

/** 표준 quiet zone. 이보다 좁으면 스캐너가 코드 경계를 못 잡는다. */
export const QR_QUIET_ZONE_MODULES = 4;

/**
 * 모듈 행렬을 SVG `path`의 `d` 문자열로 바꾼다.
 *
 * 모듈 하나당 사각형을 그리면 노드가 수천 개가 된다. 가로로 이어진 모듈을 한
 * 사각형으로 합쳐 TV에서 매 전환마다 다시 그려도 부담이 없게 한다.
 *
 * 좌표계는 모듈 단위이며 quiet zone만큼 평행이동한다. 실제 크기는 viewBox가 정한다.
 */
export function toQrPathData(
  matrix: QrMatrix,
  quietZone: number = QR_QUIET_ZONE_MODULES,
): string {
  const parts: string[] = [];

  for (let row = 0; row < matrix.moduleCount; row++) {
    const cells = matrix.modules[row]!;
    let runStart: number | null = null;

    for (let col = 0; col <= matrix.moduleCount; col++) {
      const dark = col < matrix.moduleCount && cells[col] === true;
      if (dark && runStart === null) {
        runStart = col;
      } else if (!dark && runStart !== null) {
        const x = runStart + quietZone;
        const y = row + quietZone;
        parts.push(`M${x} ${y}h${col - runStart}v1h-${col - runStart}z`);
        runStart = null;
      }
    }
  }

  return parts.join("");
}

/** quiet zone을 포함한 viewBox 한 변의 길이 */
export function qrViewBoxSize(
  matrix: QrMatrix,
  quietZone: number = QR_QUIET_ZONE_MODULES,
): number {
  return matrix.moduleCount + quietZone * 2;
}
