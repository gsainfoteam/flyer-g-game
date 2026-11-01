/**
 * 전단지 서비스 설문 문항. 프론트(`src/entities/survey/model/questions.ts`)의 사본이다.
 * 서버는 같은 규칙으로 다시 검증한다. 문항을 바꾸면 둘 다 고친다.
 *
 * 1~7번은 누르기만 하면 되고 필수다. 8·9번은 주관식이고 비워도 제출할 수 있다.
 * 선택지 id는 저장값이라 한 번 정하면 바꾸지 않는다. 화면 문구(label)는 바꿔도 된다.
 */
export interface ChoiceOption {
  id: string;
  label: string;
  /** 고르면 다른 선택을 모두 지운다(예: "특별히 불편한 부분이 없었다") */
  exclusive?: boolean;
  /** 고르면 짧은 설명을 적을 칸이 열린다(기타) */
  other?: boolean;
}

export type SurveyQuestion =
  | { id: string; kind: 'single'; title: string; options: ChoiceOption[] }
  | { id: string; kind: 'multi'; title: string; options: ChoiceOption[] }
  | {
      id: string;
      kind: 'text';
      title: string;
      optional: true;
      placeholder: string;
    };

export const SURVEY_TEXT_MAX = 1_000;
export const SURVEY_OTHER_MAX = 100;

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'board_viewed',
    kind: 'single',
    title: '구관 또는 신관 로비에 설치된 전단지 디지털 게시판을 살펴보셨나요?',
    options: [
      { id: 'detailed', label: '공지·포스터 내용을 자세히 살펴봤다' },
      { id: 'glanced', label: '화면을 잠깐 살펴봤다' },
      { id: 'game_only', label: '게임만 참여하고 게시판은 보지 않았다' },
      { id: 'not_yet', label: '아직 보지 않았다' },
    ],
  },
  {
    id: 'info_sources',
    kind: 'multi',
    title: '평소 교내 행사나 동아리 관련 정보는 어디서 얻으시나요?',
    options: [
      { id: 'ziggle', label: '지글(Ziggle)' },
      { id: 'everytime', label: '에브리타임' },
      { id: 'sns', label: '인스타그램 등 SNS' },
      { id: 'paper_board', label: '기숙사 종이 게시판' },
      { id: 'chat', label: '단체 채팅방·친구 및 지인' },
      { id: 'other', label: '기타', other: true },
    ],
  },
  {
    id: 'wanted_info',
    kind: 'multi',
    title: '전단지에서 가장 확인하고 싶은 정보는 무엇인가요?',
    options: [
      { id: 'events', label: '교내 행사·이벤트' },
      { id: 'clubs', label: '동아리 모집 및 활동' },
      { id: 'notices', label: '학교·기숙사 공지사항' },
      { id: 'careers', label: '공모전·대외활동·취업 정보' },
      { id: 'campus_life', label: '학생 생활 정보(식단, 시설 등)' },
      { id: 'other', label: '기타', other: true },
    ],
  },
  {
    id: 'readability',
    kind: 'single',
    title: '전단지 TV 화면에서 공지나 포스터 내용을 읽기 편하셨나요?',
    options: [
      { id: '1', label: '1점 · 매우 불편했다' },
      { id: '2', label: '2점 · 불편했다' },
      { id: '3', label: '3점 · 보통이다' },
      { id: '4', label: '4점 · 편했다' },
      { id: '5', label: '5점 · 매우 편했다' },
      { id: 'not_looked', label: '자세히 살펴보지 않았다' },
    ],
  },
  {
    id: 'pain_points',
    kind: 'multi',
    title: '전단지를 사용하면서 가장 불편했던 부분은 무엇인가요?',
    options: [
      { id: 'small_text', label: '글씨나 포스터가 작아 읽기 어렵다' },
      { id: 'too_fast', label: '화면이 너무 빨리 바뀐다' },
      { id: 'hard_to_find', label: '관심 있는 정보를 찾기 어렵다' },
      { id: 'no_detail', label: '공지의 자세한 내용을 확인하기 어렵다' },
      { id: 'complex', label: '화면 구성이나 디자인이 복잡하다' },
      { id: 'lacking', label: '필요하거나 관심 있는 정보가 부족하다' },
      { id: 'none', label: '특별히 불편한 부분이 없었다', exclusive: true },
      { id: 'other', label: '기타', other: true },
    ],
  },
  {
    id: 'satisfaction',
    kind: 'single',
    title: '전단지 서비스에 대한 전반적인 만족도는 몇 점인가요?',
    options: [
      { id: '1', label: '1점 · 매우 불만족' },
      { id: '2', label: '2점 · 불만족' },
      { id: '3', label: '3점 · 보통' },
      { id: '4', label: '4점 · 만족' },
      { id: '5', label: '5점 · 매우 만족' },
      { id: 'not_rated', label: '평가할 만큼 살펴보지 않았다' },
    ],
  },
  {
    id: 'revisit',
    kind: 'single',
    title: '앞으로 기숙사 로비를 지나갈 때 전단지를 확인할 의향이 있나요?',
    options: [
      { id: '5', label: '매우 그렇다' },
      { id: '4', label: '그렇다' },
      { id: '3', label: '보통이다' },
      { id: '2', label: '그렇지 않다' },
      { id: '1', label: '전혀 그렇지 않다' },
    ],
  },
  {
    id: 'improve_first',
    kind: 'text',
    title:
      '전단지에서 가장 먼저 개선되었으면 하는 부분은 무엇인가요? 그 이유도 함께 알려주세요.',
    optional: true,
    placeholder: '비워 두고 제출해도 돼요',
  },
  {
    id: 'new_features',
    kind: 'text',
    title: '전단지에 새롭게 추가되었으면 하는 정보나 기능이 있나요?',
    optional: true,
    placeholder: '비워 두고 제출해도 돼요',
  },
];

/**
 * 제출하는 응답. 객관식은 선택지 id(복수 선택은 배열), 주관식은 글이다.
 * "기타"에 적은 말은 `others[문항 id]`에 둔다.
 */
export interface SurveyAnswers {
  answers: Record<string, string | string[]>;
  others: Record<string, string>;
}

export type SurveyProblem = { questionId: string; message: string };

/** 빠진 필수 문항이나 잘못된 값을 찾는다. 없으면 빈 배열. 서버도 같은 규칙으로 다시 확인한다. */
export function validateSurvey(input: SurveyAnswers): SurveyProblem[] {
  const problems: SurveyProblem[] = [];
  for (const question of SURVEY_QUESTIONS) {
    const value = input.answers[question.id];
    if (question.kind === 'text') {
      if (value !== undefined && typeof value !== 'string') {
        problems.push({ questionId: question.id, message: '글로 적어 주세요' });
      } else if (typeof value === 'string' && value.length > SURVEY_TEXT_MAX) {
        problems.push({
          questionId: question.id,
          message: `${SURVEY_TEXT_MAX}자까지 적을 수 있어요`,
        });
      }
      continue;
    }
    const ids = new Set(question.options.map((option) => option.id));
    if (question.kind === 'single') {
      if (typeof value !== 'string' || !ids.has(value)) {
        problems.push({
          questionId: question.id,
          message: '하나를 골라 주세요',
        });
      }
      continue;
    }
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((item) => ids.has(item))
    ) {
      problems.push({
        questionId: question.id,
        message: '하나 이상 골라 주세요',
      });
      continue;
    }
    if (new Set(value).size !== value.length) {
      problems.push({
        questionId: question.id,
        message: '같은 선택이 두 번 들어갔어요',
      });
      continue;
    }
    const exclusive = question.options.find(
      (option) => option.exclusive && value.includes(option.id),
    );
    if (exclusive && value.length > 1) {
      problems.push({
        questionId: question.id,
        message: `"${exclusive.label}"은 다른 것과 함께 고를 수 없어요`,
      });
    }
  }
  for (const [questionId, text] of Object.entries(input.others)) {
    if (typeof text !== 'string' || text.length > SURVEY_OTHER_MAX) {
      problems.push({
        questionId,
        message: `기타는 ${SURVEY_OTHER_MAX}자까지 적을 수 있어요`,
      });
    }
  }
  return problems;
}
