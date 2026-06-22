import type {
AnalysisResponse
} from "../../types";

export type AnalysisQuestion = {
  question?: string;
  managerAnswer?: string;
  answerStatus?: string;
  evidenceQuotes: string[];
};

export type AnalysisDetails = {
  summary: string;
  topics: string[];
  nextSteps: string[];
  dialogueTone: {
    overall?: string;
    manager?: string;
    client?: string;
    evidenceQuotes: string[];
  };
  clientQuestions: AnalysisQuestion[];
  questionCoverage: {
    status?: string;
    summary?: string;
    unansweredQuestions: string[];
  };
  managerQuality: {
    strengths: string[];
    issues: string[];
    recommendations: string[];
  };
  callOutcome?: string;
  customerObjections: string[];
  risks: string[];
  confidence?: string;
};

export const answerStatusLabels: Record<string, string> = {
  answered: "Ответ дан",
  partially_answered: "Частично отвечено",
  not_answered: "Нет ответа",
  unclear: "Неясно"
};

export const coverageStatusLabels: Record<string, string> = {
  answered: "Все вопросы закрыты",
  partially_answered: "Часть вопросов закрыта",
  not_answered: "Вопросы не закрыты",
  no_questions: "Вопросов не было",
  unclear: "Неясно"
};

export const confidenceLabels: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая"
};

export function isAnalysisDone(analysis?: AnalysisResponse) {
  return analysis?.status === "done";
}

export function analysisRecord(analysis?: AnalysisResponse) {
  const result = analysis?.result_json;
  if (!isPlainRecord(result)) {
    return {};
  }

  return result;
}

export function analysisSummary(analysis?: AnalysisResponse) {
  const record = analysisRecord(analysis);
  const summary = stringValue(record.summary);
  if (summary) return summary;
  return analysis?.result_text ?? "Анализ появится здесь после обработки звонка.";
}

export function analysisTopics(analysis?: AnalysisResponse) {
  return stringList(analysisRecord(analysis).topics);
}

export function analysisNextStep(analysis?: AnalysisResponse) {
  const record = analysisRecord(analysis);
  const nextStep = stringValue(record.next_step);
  if (nextStep) return nextStep;

  const nextSteps = stringList(record.next_steps);
  if (nextSteps.length > 0) return nextSteps[0];

  return "После анализа здесь появится рекомендуемое действие.";
}

export function analysisDetails(analysis?: AnalysisResponse): AnalysisDetails {
  const record = analysisRecord(analysis);
  const dialogueTone = recordField(record, "dialogue_tone");
  const questionCoverage = recordField(record, "question_coverage");
  const managerQuality = recordField(record, "manager_quality");
  const nextSteps = stringList(record.next_steps);
  const legacyNextStep = stringValue(record.next_step);

  return {
    summary: analysisSummary(analysis),
    topics: analysisTopics(analysis),
    nextSteps: nextSteps.length > 0 ? nextSteps : legacyNextStep ? [legacyNextStep] : [],
    dialogueTone: {
      overall: stringValue(dialogueTone?.overall),
      manager: stringValue(dialogueTone?.manager),
      client: stringValue(dialogueTone?.client),
      evidenceQuotes: stringList(dialogueTone?.evidence_quotes)
    },
    clientQuestions: questionList(record.client_questions),
    questionCoverage: {
      status: stringValue(questionCoverage?.status),
      summary: stringValue(questionCoverage?.summary),
      unansweredQuestions: stringList(questionCoverage?.unanswered_questions)
    },
    managerQuality: {
      strengths: stringList(managerQuality?.strengths),
      issues: stringList(managerQuality?.issues),
      recommendations: stringList(managerQuality?.recommendations)
    },
    callOutcome: stringValue(record.call_outcome),
    customerObjections: stringList(record.customer_objections),
    risks: stringList(record.risks),
    confidence: stringValue(record.confidence)
  };
}

export function questionList(value: unknown): AnalysisQuestion[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isPlainRecord(item)) return [];

    const question: AnalysisQuestion = {
      question: stringValue(item.question),
      managerAnswer: stringValue(item.manager_answer),
      answerStatus: stringValue(item.answer_status),
      evidenceQuotes: stringList(item.evidence_quotes)
    };

    if (
      !question.question &&
      !question.managerAnswer &&
      !question.answerStatus &&
      question.evidenceQuotes.length === 0
    ) {
      return [];
    }

    return [question];
  });
}

export function recordField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isPlainRecord(value) ? value : undefined;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringValue(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function stringList(value: unknown) {
  if (typeof value === "string") {
    const item = stringValue(value);
    return item ? [item] : [];
  }

  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const text = stringValue(item);
    return text ? [text] : [];
  });
}

export function enumLabel(value: string | undefined, labels: Record<string, string>) {
  if (!value) return undefined;
  return labels[value] ?? value;
}
