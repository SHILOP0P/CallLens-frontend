import type {
  AnalysisResponse,
  AnalysisV2CriteriaResult,
  AnalysisV2Question,
  AnalysisV2Result
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

export const criteriaStatusLabels: Record<string, string> = {
  met: "Выполнено",
  partially_met: "Частично",
  missed: "Пропущено",
  not_applicable: "Не применимо",
  unclear: "Неясно"
};

export const businessOutcomeLabels: Record<string, string> = {
  success: "Успех",
  follow_up_needed: "Нужен следующий контакт",
  no_decision: "Без решения",
  lost: "Потеряно",
  support_resolved: "Поддержка решена",
  not_call: "Не звонок",
  unclear: "Неясно"
};

export const lostReasonLabels: Record<string, string> = {
  price: "Цена",
  timing: "Сроки",
  no_need: "Нет потребности",
  competitor: "Конкурент",
  no_next_step: "Нет следующего шага",
  unclear_value: "Ценность не раскрыта",
  bad_fit: "Не подходит",
  not_applicable: "Не применимо",
  unclear: "Неясно"
};

export const confidenceLabels: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая"
};

export const priorityLabels: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий"
};

export const severityLabels: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая"
};

export const signalLevelLabels: Record<string, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  unclear: "Неясно"
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

export function analysisV2Result(analysis?: AnalysisResponse): AnalysisV2Result | null {
  const record = analysisRecord(analysis);
  const criteria = criteriaResultList(record.criteria_results);
  const schemaVersion = numberValue(record.schema_version);
  const scoreScale = numberValue(record.score_scale);
  const looksLikeV2 = schemaVersion === 2 || (scoreScale === 100 && criteria.length > 0);

  if (!looksLikeV2) return null;

  const dialogueTone = recordField(record, "dialogue_tone");
  const questionCoverage = recordField(record, "question_coverage");
  const managerQuality = recordField(record, "manager_quality");
  const scoreBreakdown = recordField(record, "score_breakdown");
  const pointsAwarded = numberValue(scoreBreakdown?.points_awarded) ?? 0;
  const pointsPossible = numberValue(scoreBreakdown?.points_possible) ?? 0;
  const scoreFromBreakdown = pointsPossible > 0 ? Math.round((pointsAwarded / pointsPossible) * 100) : null;
  const nextStepQuality = recordField(record, "next_step_quality");
  const businessOutcome = recordField(record, "business_outcome");
  const customerSignals = recordField(record, "customer_signals");

  return {
    schema_version: 2,
    summary: stringValue(record.summary) ?? "",
    topics: stringList(record.topics),
    dialogue_tone: {
      overall: stringValue(dialogueTone?.overall) ?? "",
      manager: stringValue(dialogueTone?.manager) ?? "",
      client: stringValue(dialogueTone?.client) ?? "",
      evidence_quotes: stringList(dialogueTone?.evidence_quotes)
    },
    client_questions: v2QuestionList(record.client_questions),
    question_coverage: {
      status: stringValue(questionCoverage?.status) ?? "",
      summary: stringValue(questionCoverage?.summary) ?? "",
      unanswered_questions: stringList(questionCoverage?.unanswered_questions)
    },
    manager_quality: {
      strengths: stringList(managerQuality?.strengths),
      issues: stringList(managerQuality?.issues),
      recommendations: stringList(managerQuality?.recommendations)
    },
    call_outcome: stringValue(record.call_outcome) ?? "",
    score: numberValue(record.score) ?? scoreFromBreakdown ?? 0,
    score_scale: scoreScale ?? 100,
    score_breakdown: {
      points_awarded: pointsAwarded,
      points_possible: pointsPossible,
      applicable_criteria_count: numberValue(scoreBreakdown?.applicable_criteria_count) ?? criteria.length,
      total_criteria_count: numberValue(scoreBreakdown?.total_criteria_count) ?? criteria.length
    },
    criteria_results: criteria,
    customer_objections: stringList(record.customer_objections),
    risks: stringList(record.risks),
    next_steps: stringList(record.next_steps),
    next_step: stringValue(record.next_step) ?? "",
    next_step_quality: {
      has_next_step: booleanValue(nextStepQuality?.has_next_step),
      specific: booleanValue(nextStepQuality?.specific),
      has_deadline: booleanValue(nextStepQuality?.has_deadline),
      has_responsible_person: booleanValue(nextStepQuality?.has_responsible_person)
    },
    business_outcome: {
      status: stringValue(businessOutcome?.status) ?? "",
      summary: stringValue(businessOutcome?.summary) ?? "",
      lost_reason: stringValue(businessOutcome?.lost_reason) ?? ""
    },
    customer_signals: {
      intent: stringValue(customerSignals?.intent) ?? "",
      urgency: stringValue(customerSignals?.urgency) ?? "",
      budget_discussed: booleanValue(customerSignals?.budget_discussed),
      decision_maker_present: booleanValue(customerSignals?.decision_maker_present)
    },
    issue_codes: stringList(record.issue_codes),
    evidence_quotes: stringList(record.evidence_quotes),
    confidence: stringValue(record.confidence) ?? ""
  };
}

export function analysisScore100(analysis?: AnalysisResponse): {
  score: number | null;
  scale: number;
  label: string;
  percent: number;
} {
  const v2 = analysisV2Result(analysis);
  const v2Score = v2 ? finiteNumber(v2.score) : null;
  const v2Scale = v2 ? finiteNumber(v2.score_scale) ?? 100 : 100;

  if (v2 && v2Score !== null) {
    const scale = v2Scale > 0 ? v2Scale : 100;
    return {
      score: v2Score,
      scale,
      label: `${formatScore(v2Score)} / ${scale}`,
      percent: clampPercent((v2Score / scale) * 100)
    };
  }

  const record = analysisRecord(analysis);
  const rawScore = firstNumber(record, ["quality_score", "score", "overall_score", "manager_score"]);

  if (rawScore === null) {
    return {
      score: null,
      scale: 100,
      label: "Нет данных",
      percent: 0
    };
  }

  const normalized = rawScore <= 5 ? rawScore * 20 : rawScore;
  return {
    score: normalized,
    scale: 100,
    label: `${formatScore(normalized)} / 100`,
    percent: clampPercent(normalized)
  };
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

export function formatScore(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(".", ",");
}

function v2QuestionList(value: unknown): AnalysisV2Question[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isPlainRecord(item)) return [];

    const question = {
      question: stringValue(item.question) ?? "",
      manager_answer: stringValue(item.manager_answer) ?? "",
      answer_status: stringValue(item.answer_status) ?? "",
      evidence_quotes: stringList(item.evidence_quotes)
    };

    if (
      !question.question &&
      !question.manager_answer &&
      !question.answer_status &&
      question.evidence_quotes.length === 0
    ) {
      return [];
    }

    return [question];
  });
}

function criteriaResultList(value: unknown): AnalysisV2CriteriaResult[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isPlainRecord(item)) return [];

    const status = stringValue(item.status) ?? "unclear";
    if (status === "not_applicable") return [];

    const result = {
      code: stringValue(item.code) ?? "",
      title: stringValue(item.title) ?? stringValue(item.code) ?? "Критерий",
      status,
      points_awarded: numberValue(item.points_awarded) ?? 0,
      points_max: numberValue(item.points_max) ?? 0,
      evidence_quotes: stringList(item.evidence_quotes),
      issue: stringValue(item.issue) ?? "",
      recommendation: stringValue(item.recommendation) ?? ""
    };

    if (!result.code && !result.title && !result.status) return [];
    return [result];
  });
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = finiteNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function numberValue(value: unknown) {
  return finiteNumber(value);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}
