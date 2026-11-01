/**
 * 공용 TV에 띄우면 안 되는 말. 띄어쓰기·기호를 지운 뒤 찾으므로 "씨 발", "ㅅ.ㅂ"도
 * 걸린다. 완전한 목록은 아니다. 걸리면 이름 대신 팀 이름으로 부른다.
 */
const BLOCKED_WORDS = [
  "씨발",
  "시발",
  "씨팔",
  "ㅅㅂ",
  "ㅆㅂ",
  "병신",
  "ㅂㅅ",
  "좆",
  "ㅈ같",
  "개새",
  "새끼",
  "ㅅㄲ",
  "지랄",
  "ㅈㄹ",
  "미친",
  "ㅁㅊ",
  "닥쳐",
  "꺼져",
  "느금",
  "니애미",
  "애미",
  "애비",
  "섹스",
  "fuck",
  "shit",
  "bitch",
  "sex",
];

/** 화면에 안 보이는 글자(제어 문자, 폭 없는 공백, 방향 표시)를 지운다. */
export function stripInvisible(value: string): string {
  // Cf가 폭 없는 공백(U+200B)과 방향 표시(U+202E 등)를 포함한다. 줄·문단 구분자도 지운다.
  return value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "");
}

export function hasBlockedWord(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return BLOCKED_WORDS.some((word) => compact.includes(word));
}
