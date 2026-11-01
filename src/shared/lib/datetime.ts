/**
 * 날짜 규칙 (명세 6.3, 공통 품질 기준)
 * - 저장·통신은 UTC ISO 8601 문자열
 * - 입력과 표시는 Asia/Seoul
 *
 * Asia/Seoul은 1988년 이후 일광절약시간을 쓰지 않으므로 고정 +09:00으로 다룬다.
 * 이 가정이 깨지면 `SEOUL_UTC_OFFSET`만 바꾸지 말고 Intl 기반 변환으로 교체해야 한다.
 */
export const SEOUL_UTC_OFFSET = "+09:00";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export class InvalidDateError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`유효한 ISO 8601 날짜 문자열이 아닙니다: ${value}`);
    this.name = "InvalidDateError";
    this.value = value;
  }
}

/** API DTO의 ISO 8601 문자열을 Date로 바꾼다. 잘못된 값은 조용히 통과시키지 않는다. */
export function parseIsoUtc(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new InvalidDateError(value);
  return date;
}

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 서울 달력 기준으로 n개월 뒤의 같은 시각. 그 달에 같은 날짜가 없으면 말일로 맞춘다.
 * 예: 2026-01-31 10:00 KST + 1개월 = 2026-02-28 10:00 KST
 *
 * 최대 게시 기간(개월) 판정에 쓴다. 서버(`flyer-g-be` `addMonthsInSeoul`)와 같은 규칙이다.
 */
export function addSeoulMonths(date: Date, months: number): Date {
  // UTC 필드가 서울 벽시계 시각을 나타내도록 옮긴다.
  const local = new Date(date.getTime() + SEOUL_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const shifted = Date.UTC(
    year,
    month,
    Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(shifted - SEOUL_OFFSET_MS);
}

/** Date를 API로 보낼 UTC ISO 8601 문자열로 바꾼다. */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}

export interface SeoulParts {
  year: number;
  month: number;
  day: number;
  weekday: (typeof WEEKDAYS)[number];
  hour24: number;
  hour12: number;
  minute: number;
  meridiem: "AM" | "PM";
}

/** UTC 시각을 Asia/Seoul 벽시계 구성요소로 분해한다. */
export function getSeoulParts(date: Date): SeoulParts {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const hour24 = shifted.getUTCHours();
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: WEEKDAYS[shifted.getUTCDay()]!,
    hour24,
    hour12: hour24 % 12 || 12,
    minute: shifted.getUTCMinutes(),
    meridiem: hour24 >= 12 ? "PM" : "AM",
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "2026. 06. 08." */
export function formatSeoulDate(date: Date): string {
  const { year, month, day } = getSeoulParts(date);
  return `${year}. ${pad(month)}. ${pad(day)}.`;
}

/** "2026. 06. 08. (월)" */
export function formatSeoulDateWithWeekday(date: Date): string {
  const { weekday } = getSeoulParts(date);
  return `${formatSeoulDate(date)} (${weekday})`;
}

/** "2026. 06. 08. 13:30" */
export function formatSeoulDateTime(date: Date): string {
  const { hour24, minute } = getSeoulParts(date);
  return `${formatSeoulDate(date)} ${pad(hour24)}:${pad(minute)}`;
}

/** "2026. 06. 08. ~ 2026. 06. 15." */
export function formatSeoulPeriod(startAt: Date, endAt: Date): string {
  return `${formatSeoulDate(startAt)} ~ ${formatSeoulDate(endAt)}`;
}

/** `<input type="date">`가 요구하는 Asia/Seoul 기준 "YYYY-MM-DD" */
export function toSeoulDateInputValue(date: Date): string {
  const { year, month, day } = getSeoulParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `<input type="datetime-local">`가 요구하는 Asia/Seoul 기준 "YYYY-MM-DDTHH:mm" */
export function toSeoulDateTimeInputValue(date: Date): string {
  const { hour24, minute } = getSeoulParts(date);
  return `${toSeoulDateInputValue(date)}T${pad(hour24)}:${pad(minute)}`;
}

/**
 * 사용자가 Asia/Seoul 기준으로 입력한 값을 UTC Date로 바꾼다.
 * 날짜만 있으면 그날 00:00 (Asia/Seoul)로 본다.
 */
export function fromSeoulInput(value: string): Date {
  const normalized = value.includes("T") ? value : `${value}T00:00`;
  const withSeconds =
    normalized.length === 16 ? `${normalized}:00` : normalized;
  return parseIsoUtc(`${withSeconds}${SEOUL_UTC_OFFSET}`);
}

/**
 * 얼마나 기다렸는지 사람이 읽는 형태로 나타낸다. "3일", "19시간", "12분".
 * 관리자 목록에서 오래 기다린 건을 먼저 알아보게 하기 위한 것이다.
 */
export function formatElapsed(since: Date, now: Date): string {
  // 1분이 안 됐어도 "1분"으로 읽는다. "0분째 기다리고 있어요"는 말이 되지 않는다.
  const minutes = Math.max(
    1,
    Math.floor((now.getTime() - since.getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}

/** "08. 21." — 기간을 좁은 칸에 넣을 때 쓴다. */
/**
 * 지난 시각을 "방금", "12분 전"처럼 읽는다. 기기의 마지막 연결처럼 짧은 간격을
 * 보여줄 때 쓴다. 기준 시각보다 미래면 "방금"으로 본다.
 */
export function formatTimeAgo(since: Date, now: Date): string {
  const seconds = Math.floor((now.getTime() - since.getTime()) / 1000);
  if (seconds < 60) return "방금";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatSeoulShortDate(date: Date): string {
  const { month, day } = getSeoulParts(date);
  return `${pad(month)}. ${pad(day)}.`;
}

/** 서울 달력으로 `from`의 날에서 `to`의 날까지 며칠인가. 같은 날이면 0이다. */
export function seoulDayDiff(from: Date, to: Date): number {
  const dayNumber = (date: Date) => {
    const { year, month, day } = getSeoulParts(date);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  return dayNumber(to) - dayNumber(from);
}

/** "09. 30.(수)" — 요일을 붙인 짧은 날짜 */
export function formatSeoulShortDateWithWeekday(date: Date): string {
  return `${formatSeoulShortDate(date)}(${getSeoulParts(date).weekday})`;
}

/**
 * 일이 일어난 때를 가까울수록 짧게 읽는다. "오늘 14:10", "어제 18:40",
 * "09. 22. 00:00". 소식 목록처럼 최근 일을 늘어놓을 때 쓴다.
 */
export function formatSeoulDayTime(date: Date, now: Date): string {
  const { hour24, minute } = getSeoulParts(date);
  const time = `${pad(hour24)}:${pad(minute)}`;
  const diff = seoulDayDiff(date, now);
  if (diff === 0) return `오늘 ${time}`;
  if (diff === 1) return `어제 ${time}`;
  return `${formatSeoulShortDate(date)} ${time}`;
}

/** "10. 03.(토) 23:59" — 요일을 붙인 짧은 날짜와 시각 */
export function formatSeoulShortDateTime(date: Date): string {
  const { hour24, minute } = getSeoulParts(date);
  return `${formatSeoulShortDateWithWeekday(date)} ${pad(hour24)}:${pad(minute)}`;
}
