import { useState } from "react";
import {
  SURVEY_OTHER_MAX,
  SURVEY_QUESTIONS,
  SURVEY_TEXT_MAX,
  toggleChoice,
  validateSurvey,
} from "@/entities/survey/model/questions";
import type { SurveyAnswers, SurveyQuestion } from "@/entities/survey/model/questions";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

/**
 * 전단지 설문. 1~7번은 누르기만 하면 되고, 8·9번은 비워도 낼 수 있다.
 *
 * 쓰던 답은 이 탭에 남겨 둔다. 실수로 새로고침해도 처음부터 다시 누르지 않게 한다.
 */
const DRAFT_KEY = "flyerg:shuffleboard-survey-draft";

function readDraft(): SurveyAnswers {
  try {
    const saved = window.sessionStorage.getItem(DRAFT_KEY);
    if (saved) return JSON.parse(saved) as SurveyAnswers;
  } catch {
    // 초안이 없거나 못 읽으면 빈 설문
  }
  return { answers: {}, others: {} };
}

function writeDraft(draft: SurveyAnswers | null) {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 초안 저장은 편의 기능이다.
  }
}

/** 보낼 값만 남긴다. 고르지 않은 "기타"의 글, 빈 주관식은 뺀다. */
function cleaned(draft: SurveyAnswers): SurveyAnswers {
  const answers: SurveyAnswers["answers"] = {};
  const others: SurveyAnswers["others"] = {};
  for (const question of SURVEY_QUESTIONS) {
    const value = draft.answers[question.id];
    if (question.kind === "text") {
      const text = typeof value === "string" ? value.trim() : "";
      if (text) answers[question.id] = text;
      continue;
    }
    if (value !== undefined) answers[question.id] = value;
    const otherId = question.options.find((option) => option.other)?.id;
    const picked = Array.isArray(value) ? value : [value];
    const otherText = draft.others[question.id]?.trim();
    if (otherId && picked.includes(otherId) && otherText) others[question.id] = otherText;
  }
  return { answers, others };
}

export function SurveyForm({ onSubmit }: { onSubmit: (answers: SurveyAnswers) => void }) {
  const [draft, setDraft] = useState<SurveyAnswers>(readDraft);
  const [shownProblems, setShownProblems] = useState<Record<string, string>>({});

  const update = (next: SurveyAnswers) => {
    setDraft(next);
    writeDraft(next);
    // 고친 문항의 안내는 지운다.
    setShownProblems((current) => {
      const remaining = Object.fromEntries(
        validateSurvey(cleaned(next)).map((problem) => [problem.questionId, problem.message]),
      );
      return Object.fromEntries(Object.keys(current).filter((id) => remaining[id]).map((id) => [id, remaining[id]]));
    });
  };
  const setAnswer = (id: string, value: string | string[]) =>
    update({ ...draft, answers: { ...draft.answers, [id]: value } });
  const setOther = (id: string, value: string) =>
    update({ ...draft, others: { ...draft.others, [id]: value } });

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        const answers = cleaned(draft);
        const problems = validateSurvey(answers);
        if (problems.length > 0) {
          setShownProblems(Object.fromEntries(problems.map((p) => [p.questionId, p.message])));
          document.getElementById(`q-${problems[0].questionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        writeDraft(null);
        onSubmit(answers);
      }}
    >
      <ol className="flex flex-col gap-8">
        {SURVEY_QUESTIONS.map((question, index) => (
          <li key={question.id} id={`q-${question.id}`}>
            <QuestionField
              number={index + 1}
              question={question}
              value={draft.answers[question.id]}
              other={draft.others[question.id] ?? ""}
              problem={shownProblems[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
              onOtherChange={(value) => setOther(question.id, value)}
            />
          </li>
        ))}
      </ol>
      <Button type="submit" size="lg" className="h-14 text-subhead">
        설문 내고 랭킹에 올리기
      </Button>
    </form>
  );
}

function QuestionField({
  number,
  question,
  value,
  other,
  problem,
  onChange,
  onOtherChange,
}: {
  number: number;
  question: SurveyQuestion;
  value: string | string[] | undefined;
  other: string;
  problem: string | undefined;
  onChange: (value: string | string[]) => void;
  onOtherChange: (value: string) => void;
}) {
  const problemId = `q-${question.id}-problem`;
  const legend = (
    <legend className="mb-3 text-subhead text-ink">
      {number}. {question.title}
      {question.kind === "multi" && <span className="text-ink-muted"> (여러 개 고를 수 있어요)</span>}
      {question.kind === "text" && <span className="text-ink-muted"> (선택)</span>}
    </legend>
  );

  if (question.kind === "text") {
    const text = typeof value === "string" ? value : "";
    return (
      <fieldset>
        {legend}
        <Textarea
          value={text}
          maxLength={SURVEY_TEXT_MAX}
          rows={4}
          placeholder={question.placeholder}
          aria-label={question.title}
          aria-describedby={problem ? problemId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="text-body"
        />
        <p className="mt-1 text-right text-caption text-ink-subtle tabular-nums">
          {text.length} / {SURVEY_TEXT_MAX}
        </p>
        {problem && <Problem id={problemId} message={problem} />}
      </fieldset>
    );
  }

  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const otherOption = question.options.find((option) => option.other);
  return (
    <fieldset aria-describedby={problem ? problemId : undefined}>
      {legend}
      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-control px-4 py-3 text-body",
                checked ? "bg-accent-100 text-ink" : "bg-surface text-ink",
              )}
            >
              <input
                type={question.kind === "single" ? "radio" : "checkbox"}
                name={question.id}
                value={option.id}
                checked={checked}
                onChange={() =>
                  question.kind === "single"
                    ? onChange(option.id)
                    : onChange(toggleChoice(question, selected, option.id))
                }
                className="size-5 shrink-0 accent-accent"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {otherOption && selected.includes(otherOption.id) && (
        <Input
          value={other}
          maxLength={SURVEY_OTHER_MAX}
          placeholder="기타 내용을 적어 주세요 (선택)"
          aria-label={`${number}번 기타 내용`}
          onChange={(event) => onOtherChange(event.target.value)}
          className="mt-2 h-12 text-body"
        />
      )}
      {problem && <Problem id={problemId} message={problem} />}
    </fieldset>
  );
}

function Problem({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-2 text-label text-danger">
      {message}
    </p>
  );
}
