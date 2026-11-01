/**
 * TV 스테이지 실측 치수. 1920x1080 기준 고정 px이며, 축소는 감싸는 쪽이 한다.
 * 컴포넌트와 페이지가 함께 참조하므로 순환 import를 피해 별도 모듈에 둔다.
 */
export const TV_STAGE_WIDTH = 1920;
export const TV_STAGE_HEIGHT = 1080;
/** 화면 가장자리 안전 여백. TV 오버스캔과 베젤을 감안한 값이다. */
export const TV_STAGE_PADDING = 80;

/** 머리 줄(로고·기기 이름·시계) 높이와 본문과의 간격 */
export const STAGE_HEADER_HEIGHT = 56;
export const STAGE_HEADER_GAP = 32;
