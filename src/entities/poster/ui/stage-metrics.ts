/**
 * TV 스테이지 실측 치수. 1920x1080 기준 고정 px이며, 축소는 감싸는 쪽이 한다.
 * 컴포넌트와 페이지가 함께 참조하므로 순환 import를 피해 별도 모듈에 둔다.
 */
export const TV_STAGE_WIDTH = 1920;
export const TV_STAGE_HEIGHT = 1080;
/** 화면 가장자리 안전 여백. TV 오버스캔과 베젤을 감안한 값이다. */
export const TV_STAGE_PADDING = 80;

/** 머리 줄(로고·기기 이름·날짜) 높이와 본문과의 간격 */
export const STAGE_HEADER_HEIGHT = 56;
export const STAGE_HEADER_GAP = 32;

/**
 * 아래 정보줄(시각·날씨·식사·D-day·다음 화면). 화면 폭을 다 쓰고 아래 끝에 붙는다.
 * 아래 여백(80px)을 정보줄이 쓰므로 본문은 `INFO_BAR_HEIGHT - 여백 + 간격`만 줄어든다.
 */
export const INFO_BAR_HEIGHT = 96;
/** 본문과 정보줄 사이의 숨 쉴 공간. 미리보기 조작도 이 간격 안에 둔다. */
export const INFO_BAR_GAP = 48;

/** 여백 안쪽에서 정보줄을 뺀 본문 높이(머리 줄 포함) */
export const STAGE_BODY_HEIGHT =
  TV_STAGE_HEIGHT - TV_STAGE_PADDING - INFO_BAR_HEIGHT - INFO_BAR_GAP;
