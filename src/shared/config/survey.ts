/**
 * 전단지 설문(노션폼) 주소. TV 오른쪽 위 QR과 폰 결과 화면의 버튼이 이 주소로 간다.
 * 설문 문항과 응답은 노션에서 관리한다. 이 앱은 주소만 안다.
 *
 * `.env`의 `VITE_SURVEY_URL`에 넣는다. 비어 있으면 TV는 QR 자리에 "설문 주소 설정 필요"를
 * 띄우고, 폰은 설문 버튼을 숨긴다.
 */
export function surveyUrl(): string | null {
  const url = (import.meta.env.VITE_SURVEY_URL as string | undefined)?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
