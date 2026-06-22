import type {
  AnalysisResponse
} from "../../types";

import { analysisDetails, AnalysisQuestion, answerStatusLabels, confidenceLabels, coverageStatusLabels, enumLabel } from "../lib/analysis";
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
