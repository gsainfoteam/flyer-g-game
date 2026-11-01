/**
 * 설문(노션폼) 주소. TV 오른쪽 위 QR과 폰 결과 화면의 버튼이 이 주소로 간다.
 *
 * 전단지에서는 운영 설정(`entities/widget/model/operation.ts`의 `SURVEY_URL`)이 원본이다.
 * 이 시제품은 같은 공개 링크를 기본값으로 쓰고, `.env`의 `VITE_SURVEY_URL`로 바꿀 수 있다.
 * 로그인 없이 열리는 공개 링크(https)여야 한다.
 */
const DEFAULT_SURVEY_URL =
  "https://pacific-switch-8c6.notion.site/409084b8aa7980be943ad6c656b91bf7";

export const SURVEY_LABEL = "이벤트 설문";

export function surveyUrl(): string | null {
  const url = (import.meta.env.VITE_SURVEY_URL as string | undefined)?.trim() || DEFAULT_SURVEY_URL;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** TV 화면에 넘기는 설문 값. 클릭 배틀 위젯의 `survey`와 같은 모양이다. */
export function surveyQr(): { url: string; label: string } | null {
  const url = surveyUrl();
  return url ? { url, label: SURVEY_LABEL } : null;
}
