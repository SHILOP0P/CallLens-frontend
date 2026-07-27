import type {
  AnalysisResponse
} from "../../types";

import {
  analysisDetails,
  analysisAdditionalFields,
  analysisFormatError,
  AnalysisQuestion,
  analysisScore100,
  analysisV2Result,
  answerStatusLabels,
  businessOutcomeLabels,
  confidenceLabels,
  coverageStatusLabels,
  criteriaStatusLabels,
  enumLabel,
  formatScore,
  isAnalysisDone,
  lostReasonLabels,
  signalLevelLabels
} from "../lib/analysis";
import { TextBlockSkeleton } from "./loading";

export function AnalysisPreview({
  analysis,
  expanded,
  loading,
  pendingMessage
}: {
  analysis?: AnalysisResponse;
  expanded: boolean;
  loading?: boolean;
  pendingMessage?: string;
}) {
  if (loading) {
    return <TextBlockSkeleton rows={4} />;
  }

  if (!analysis || !isAnalysisDone(analysis)) {
    return <p className="muted">{pendingMessage ?? "Запустите анализ после готовой расшифровки."}</p>;
  }

  return (
    <div className={`analysis-preview analysis-full-text expandable-content ${expanded ? "expanded" : "collapsed"}`}>
      <AnalysisStructuredView analysis={analysis} />
    </div>
  );
}

export function AnalysisStructuredView({ analysis }: { analysis?: AnalysisResponse; }) {
  if (!analysis) {
    return <p className="muted">Запустите анализ после готовой расшифровки.</p>;
  }

  const details = analysisDetails(analysis);
  const formatError = analysisFormatError(analysis);
  if (formatError) {
    return (
      <div className="analysis-structured">
        <AnalysisSection title="Резюме">
          <p>{details.summary}</p>
        </AnalysisSection>
        <AnalysisSection title="Анализ не завершён">
          <p className="analysis-empty">{formatError}</p>
        </AnalysisSection>
      </div>
    );
  }

  const v2 = analysisV2Result(analysis);
  if (v2) {
    return <AnalysisV2View analysis={analysis} />;
  }

  const additionalFields = analysisAdditionalFields(analysis);

  return (
    <div className="analysis-structured">
      <AnalysisSection title="Резюме">
        <p>{details.summary}</p>
      </AnalysisSection>

      <AnalysisSection title="Ключевые темы">
        <div className="topic-list">
          {details.topics.length > 0 ? (
            details.topics.map((topic) => <span key={topic}>{topic}</span>)
          ) : (
            <span>Темы не указаны</span>
          )}
        </div>
      </AnalysisSection>

      <AnalysisSection title="Тон диалога">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue label="Общий тон" value={details.dialogueTone.overall} />
          <AnalysisKeyValue label="Менеджер" value={details.dialogueTone.manager} />
          <AnalysisKeyValue label="Клиент" value={details.dialogueTone.client} />
        </div>
        <EvidenceQuotes quotes={details.dialogueTone.evidenceQuotes} />
      </AnalysisSection>

      <AnalysisSection title="Вопросы клиента и ответы менеджера">
        <AnalysisQuestionList questions={details.clientQuestions} />
      </AnalysisSection>

      <AnalysisSection title="Полнота ответов менеджера">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue
            label="Статус"
            value={enumLabel(details.questionCoverage.status, coverageStatusLabels)}
          />
          <AnalysisKeyValue label="Итог" value={details.questionCoverage.summary} />
        </div>
        <AnalysisStringList
          items={details.questionCoverage.unansweredQuestions}
          emptyLabel="Незакрытые вопросы не указаны"
        />
      </AnalysisSection>

      <AnalysisSection title="Качество менеджера">
        <div className="analysis-columns">
          <div>
            <strong>Сильные стороны</strong>
            <AnalysisStringList items={details.managerQuality.strengths} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Проблемы</strong>
            <AnalysisStringList items={details.managerQuality.issues} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Рекомендации</strong>
            <AnalysisStringList items={details.managerQuality.recommendations} emptyLabel="Не указаны" />
          </div>
        </div>
      </AnalysisSection>

      {additionalFields.length > 0 && (
        <AnalysisSection title="Дополнительные результаты анализа">
          <div className="analysis-columns">
            {additionalFields.map((field) => (
              <div key={field.label}>
                <strong>{field.label}</strong>
                {Array.isArray(field.value) ? <AnalysisStringList items={field.value} emptyLabel="" /> : <p>{field.value}</p>}
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}

      <AnalysisSection title="Итог, риски и следующие шаги">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue label="Итог звонка" value={details.callOutcome} />
          <AnalysisKeyValue label="Уверенность" value={enumLabel(details.confidence, confidenceLabels)} />
        </div>
        <div className="analysis-columns">
          <div>
            <strong>Возражения клиента</strong>
            <AnalysisStringList items={details.customerObjections} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Риски</strong>
            <AnalysisStringList items={details.risks} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Следующие шаги</strong>
            <AnalysisStringList items={details.nextSteps} emptyLabel="Не указаны" />
          </div>
        </div>
      </AnalysisSection>
    </div>
  );
}

function AnalysisV2View({ analysis }: { analysis: AnalysisResponse; }) {
  const result = analysisV2Result(analysis);
  const score = analysisScore100(analysis);
  const additionalFields = analysisAdditionalFields(analysis);

  if (!result) return null;

  const outcomeItems = [
    { label: "Вердикт", value: outcomeVerdict(result.business_outcome.status, result.call_outcome) },
    { label: "Ключевой вывод", value: result.business_outcome.summary || result.call_outcome },
    {
      label: "Причина",
      value: result.business_outcome.lost_reason && result.business_outcome.lost_reason !== "not_applicable"
        ? enumLabel(result.business_outcome.lost_reason, lostReasonLabels)
        : undefined
    },
    { label: "Уверенность вывода", value: enumLabel(result.confidence, confidenceLabels) }
  ].filter((item) => hasText(item.value));
  const signalItems = [
    { label: "Интерес", value: meaningfulSignal(result.customer_signals.intent) },
    { label: "Срочность", value: meaningfulSignal(result.customer_signals.urgency) },
    { label: "Бюджет обсуждался", value: result.customer_signals.budget_discussed ? "Да" : undefined },
    { label: "ЛПР присутствовал", value: result.customer_signals.decision_maker_present ? "Да" : undefined }
  ].filter((item) => hasText(item.value));
  const nextStepItems = [
    { label: "Следующий шаг", value: result.next_step || result.next_steps[0] },
    { label: "Есть шаг", value: booleanLabel(result.next_step_quality.has_next_step) },
    { label: "Конкретный", value: booleanLabel(result.next_step_quality.specific) },
    { label: "Есть срок", value: booleanLabel(result.next_step_quality.has_deadline) },
    { label: "Есть ответственный", value: booleanLabel(result.next_step_quality.has_responsible_person) }
  ].filter((item) => hasText(item.value));
  const topicGroups = [
    { title: "Темы", items: result.topics },
    { title: "Риски", items: result.risks },
    { title: "Возражения", items: result.customer_objections }
  ].filter((group) => group.items.length > 0);

  return (
    <div className="analysis-structured analysis-v2">
      <AnalysisSection title="Резюме">
        <div className="analysis-score-summary">
          <div className="analysis-score-meter" style={{ "--analysis-score": score.percent } as React.CSSProperties}>
            <strong>{score.score === null ? "—" : formatScore(score.percent)}</strong>
            <span>/ 100</span>
          </div>
          <div>
            <p>{result.summary || "Резюме не указано."}</p>
          </div>
        </div>
      </AnalysisSection>

      {result.criteria_results.length > 0 && (
        <AnalysisSection title="Критерии качества">
          <div className="analysis-criteria-list">
            {result.criteria_results.map((criterion, index) => (
              <div className="analysis-criterion" key={`${criterion.code}-${index}`}>
                <div className="analysis-question-heading">
                  <strong>{criterion.title || criterion.code || "Критерий"}</strong>
                  <span className={`analysis-status ${criterionStatusTone(criterion.status)}`}>
                    {enumLabel(criterion.status, criteriaStatusLabels)}
                  </span>
                </div>
                <small>
                  Оценка: {formatTenPointScore(criterion.score)} / 10
                </small>
                <p><b>Тема:</b> {criterion.topic}</p>
                <p><b>Цитата:</b> {criterion.quote}</p>
                {criterion.explanation && <p><b>Объяснение:</b> {criterion.explanation}</p>}
                {!criterion.explanation && criterion.issue && <p><b>Объяснение:</b> {criterion.issue}</p>}
                {criterion.recommendation && <p><b>Рекомендация:</b> {criterion.recommendation}</p>}
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}

      {outcomeItems.length > 0 && (
        <AnalysisSection title="Итоговый вердикт">
          <div className="analysis-kv-grid">
            {outcomeItems.map((item) => (
              <AnalysisKeyValue key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </AnalysisSection>
      )}

      {signalItems.length > 0 && (
        <AnalysisSection title="Сигналы в разговоре">
          <div className="analysis-kv-grid">
            {signalItems.map((item) => (
              <AnalysisKeyValue key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </AnalysisSection>
      )}

      {(nextStepItems.length > 0 || result.next_steps.length > 0) && (
        <AnalysisSection title="Следующий шаг">
          {nextStepItems.length > 0 && (
            <div className="analysis-kv-grid">
              {nextStepItems.map((item) => (
                <AnalysisKeyValue key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          )}
          {result.next_steps.length > 0 && <AnalysisStringList items={result.next_steps} emptyLabel="" />}
        </AnalysisSection>
      )}

      {topicGroups.length > 0 && (
        <AnalysisSection title="Темы, риски и возражения">
          <div className="analysis-columns">
            {topicGroups.map((group) => (
              <div key={group.title}>
                <strong>{group.title}</strong>
                <AnalysisStringList items={group.items} emptyLabel="" />
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}

      {result.issue_codes.length > 0 && (
        <AnalysisSection title="Проблемные коды">
          <div className="topic-list">
            {result.issue_codes.map((code) => <span key={code}>{code}</span>)}
          </div>
        </AnalysisSection>
      )}

      {additionalFields.length > 0 && (
        <AnalysisSection title="Дополнительные результаты анализа">
          <div className="analysis-columns">
            {additionalFields.map((field) => (
              <div key={field.label}>
                <strong>{field.label}</strong>
                {Array.isArray(field.value) ? <AnalysisStringList items={field.value} emptyLabel="" /> : <p>{field.value}</p>}
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}
    </div>
  );
}

export function AnalysisSection({ title, children }: { title: string; children: React.ReactNode; }) {
  return (
    <section className="analysis-section">
      <strong>{title}</strong>
      {children}
    </section>
  );
}

export function AnalysisKeyValue({ label, value }: { label: string; value?: string; }) {
  return (
    <div className="analysis-kv">
      <span>{label}</span>
      <p>{value && value.trim() ? value : "Не указано"}</p>
    </div>
  );
}

export function AnalysisStringList({ items, emptyLabel }: { items: string[]; emptyLabel: string; }) {
  if (items.length === 0) {
    return <p className="analysis-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="analysis-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

export function EvidenceQuotes({ quotes }: { quotes: string[]; }) {
  if (quotes.length === 0) return null;

  return (
    <div className="evidence-quotes">
      <span>Цитаты</span>
      {quotes.map((quote, index) => (
        <blockquote key={`${quote}-${index}`}>{quote}</blockquote>
      ))}
    </div>
  );
}

export function AnalysisQuestionList({ questions }: { questions: AnalysisQuestion[]; }) {
  if (questions.length === 0) {
    return <p className="analysis-empty">Вопросы клиента не указаны.</p>;
  }

  return (
    <div className="analysis-question-list">
      {questions.map((question, index) => (
        <div className="analysis-question" key={`${question.question ?? "question"}-${index}`}>
          <div className="analysis-question-heading">
            <strong>{question.question || "Вопрос не указан"}</strong>
            <span>{enumLabel(question.answerStatus, answerStatusLabels) || "Статус не указан"}</span>
          </div>
          <p>
            <b>Ответ менеджера:</b> {question.managerAnswer || "Не указан"}
          </p>
          <EvidenceQuotes quotes={question.evidenceQuotes} />
        </div>
      ))}
    </div>
  );
}

function hasText(value?: string) {
  return Boolean(value?.trim());
}

function booleanLabel(value?: boolean | null) {
  if (typeof value !== "boolean") return undefined;
  return value ? "Да" : "Нет";
}

function meaningfulSignal(value?: string) {
  if (!value || value === "unclear") return undefined;
  return enumLabel(value, signalLevelLabels);
}

function outcomeVerdict(status: string, fallback: string) {
  if (status && status !== "unclear") return enumLabel(status, businessOutcomeLabels);
  return fallback || undefined;
}

function formatTenPointScore(score: number, scale = 100) {
  if (!Number.isFinite(score) || !Number.isFinite(scale) || scale <= 0) return "—";
  const normalized = Math.max(0, Math.min(10, (score / scale) * 10));
  return formatScore(Math.round(normalized * 10) / 10);
}

function criterionStatusTone(status: string) {
  if (status === "met") return "ok";
  if (status === "missed") return "bad";
  if (status === "partially_met" || status === "unclear") return "warn";
  return "neutral";
}
