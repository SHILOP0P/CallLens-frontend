import type {
  AnalysisResponse
} from "../../types";

import {
  analysisDetails,
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
  lostReasonLabels,
  signalLevelLabels
} from "../lib/analysis";
import { TextBlockSkeleton } from "./loading";

export function AnalysisPreview({
  analysis,
  expanded,
  loading
}: {
  analysis?: AnalysisResponse;
  expanded: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <TextBlockSkeleton rows={4} />;
  }

  if (!analysis) {
    return <p className="muted">Запустите анализ после готовой расшифровки.</p>;
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

  const v2 = analysisV2Result(analysis);
  if (v2) {
    return <AnalysisV2View analysis={analysis} />;
  }

  const details = analysisDetails(analysis);

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

  if (!result) return null;

  return (
    <div className="analysis-structured analysis-v2">
      <AnalysisSection title="Резюме">
        <div className="analysis-score-summary">
          <div className="analysis-score-meter" style={{ "--analysis-score": score.percent } as React.CSSProperties}>
            <strong>{score.score === null ? "—" : formatScore(score.score)}</strong>
            <span>/ {score.scale}</span>
          </div>
          <div>
            <p>{result.summary || "Резюме не указано."}</p>
            <small>
              Баллы: {formatScore(result.score_breakdown.points_awarded)} /{" "}
              {formatScore(result.score_breakdown.points_possible)} · применимо{" "}
              {result.score_breakdown.applicable_criteria_count} из{" "}
              {result.score_breakdown.total_criteria_count} критериев
            </small>
          </div>
        </div>
      </AnalysisSection>

      <AnalysisSection title="Критерии качества">
        {result.criteria_results.length === 0 ? (
          <p className="analysis-empty">Критерии не указаны.</p>
        ) : (
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
                  {formatScore(criterion.points_awarded)} / {formatScore(criterion.points_max)} баллов
                </small>
                {criterion.issue && <p><b>Проблема:</b> {criterion.issue}</p>}
                {criterion.recommendation && <p><b>Рекомендация:</b> {criterion.recommendation}</p>}
                <EvidenceQuotes quotes={criterion.evidence_quotes} />
              </div>
            ))}
          </div>
        )}
      </AnalysisSection>

      <AnalysisSection title="Итог и сигналы клиента">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue
            label="Итог"
            value={enumLabel(result.business_outcome.status, businessOutcomeLabels)}
          />
          <AnalysisKeyValue label="Описание" value={result.business_outcome.summary} />
          {result.business_outcome.lost_reason && result.business_outcome.lost_reason !== "not_applicable" && (
            <AnalysisKeyValue
              label="Причина потери"
              value={enumLabel(result.business_outcome.lost_reason, lostReasonLabels)}
            />
          )}
          <AnalysisKeyValue
            label="Интерес"
            value={enumLabel(result.customer_signals.intent, signalLevelLabels)}
          />
          <AnalysisKeyValue
            label="Срочность"
            value={enumLabel(result.customer_signals.urgency, signalLevelLabels)}
          />
          <AnalysisKeyValue
            label="Бюджет обсуждался"
            value={booleanLabel(result.customer_signals.budget_discussed)}
          />
          <AnalysisKeyValue
            label="ЛПР присутствовал"
            value={booleanLabel(result.customer_signals.decision_maker_present)}
          />
          <AnalysisKeyValue label="Уверенность" value={enumLabel(result.confidence, confidenceLabels)} />
        </div>
      </AnalysisSection>

      <AnalysisSection title="Следующий шаг">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue label="Следующий шаг" value={result.next_step || result.next_steps[0]} />
          <AnalysisKeyValue label="Есть шаг" value={booleanLabel(result.next_step_quality.has_next_step)} />
          <AnalysisKeyValue label="Конкретный" value={booleanLabel(result.next_step_quality.specific)} />
          <AnalysisKeyValue label="Есть срок" value={booleanLabel(result.next_step_quality.has_deadline)} />
          <AnalysisKeyValue
            label="Есть ответственный"
            value={booleanLabel(result.next_step_quality.has_responsible_person)}
          />
        </div>
        <AnalysisStringList items={result.next_steps} emptyLabel="Следующие шаги не указаны." />
      </AnalysisSection>

      <AnalysisSection title="Темы, риски и возражения">
        <div className="analysis-columns">
          <div>
            <strong>Темы</strong>
            <AnalysisStringList items={result.topics} emptyLabel="Темы не указаны" />
          </div>
          <div>
            <strong>Риски</strong>
            <AnalysisStringList items={result.risks} emptyLabel="Риски не указаны" />
          </div>
          <div>
            <strong>Возражения</strong>
            <AnalysisStringList items={result.customer_objections} emptyLabel="Возражения не указаны" />
          </div>
        </div>
      </AnalysisSection>

      <AnalysisSection title="Проблемные коды">
        <div className="topic-list">
          {result.issue_codes.length > 0 ? (
            result.issue_codes.map((code) => <span key={code}>{code}</span>)
          ) : (
            <span>Коды не указаны</span>
          )}
        </div>
      </AnalysisSection>
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

function booleanLabel(value: boolean) {
  return value ? "Да" : "Нет";
}

function criterionStatusTone(status: string) {
  if (status === "met") return "ok";
  if (status === "missed") return "bad";
  if (status === "partially_met" || status === "unclear") return "warn";
  return "neutral";
}
