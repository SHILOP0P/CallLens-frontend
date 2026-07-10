import type {
  AggregateAnalysisResult,
  AggregateCallEvidence,
  AggregateCriterionMetric,
  AggregateDetailedReport,
  AggregateFinding,
  AggregateFrequency,
  AggregateIssueDetail,
  AggregateMetricDetail,
  AggregateNextStepSummary,
  AggregatePriorityAction,
  AggregateRecurringIssue,
  AggregateScoreSummary,
  AggregateSourceSummary,
  AggregateStatistics
} from "../../types";

type UnknownRecord = Record<string, unknown>;

/**
 * Normalizes the asynchronous aggregate-analysis JSON without trusting its
 * schema. Historical analyses can have the legacy shape, while a partially
 * completed provider response can omit any optional block.
 */
export function aggregateResult(value: unknown): AggregateAnalysisResult | null {
  if (!isRecord(value)) return null;

  return {
    summary: stringValue(value.summary) ?? "",
    aggregate_schema_version: numberValue(value.aggregate_schema_version),
    executive_summary: stringValue(value.executive_summary),
    overall_assessment: stringValue(value.overall_assessment),
    source_summary: sourceSummary(value.source_summary),
    aggregate_statistics: aggregateStatistics(value.aggregate_statistics),
    coverage_note: stringValue(value.coverage_note),
    key_findings: findingList(value.key_findings),
    recurring_issues: recurringIssueList(value.recurring_issues),
    systemic_issues: issueDetailList(value.systemic_issues),
    single_call_observations: issueDetailList(value.single_call_observations),
    weak_criteria: metricDetailList(value.weak_criteria),
    client_objections: metricDetailList(value.client_objections),
    loss_and_risk_patterns: issueDetailList(value.loss_and_risk_patterns),
    strengths: stringList(value.strengths),
    risks: stringList(value.risks),
    priority_actions: priorityActionList(value.priority_actions),
    manager_recommendations: stringList(value.manager_recommendations),
    confidence: stringValue(value.confidence) ?? "unclear",
    detailed_report: detailedReport(value.detailed_report)
  };
}

export function formatShare(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) return "—";

  return new Intl.NumberFormat("ru-RU", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

export function callCountLabel(value?: number | null) {
  const count = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} звонок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} звонка`;
  return `${count} звонков`;
}

export function shortIdentifier(value?: string) {
  if (!value) return "";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function sourceSummary(value: unknown): AggregateSourceSummary | undefined {
  if (!isRecord(value)) return undefined;

  const result: AggregateSourceSummary = {
    analyzed_calls: numberValue(value.analyzed_calls),
    included_in_statistics: numberValue(value.included_in_statistics),
    representative_calls: numberValue(value.representative_calls),
    all_analyzed_calls_used: booleanValue(value.all_analyzed_calls_used),
    source_set_hash: stringValue(value.source_set_hash)
  };

  return hasDefinedValue(result) ? result : undefined;
}

function aggregateStatistics(value: unknown): AggregateStatistics | undefined {
  if (!isRecord(value)) return undefined;

  const result: AggregateStatistics = {
    score_summary: scoreSummary(value.score_summary),
    issue_coverage: frequencyList(value.issue_coverage),
    weak_criteria: criterionMetricList(value.weak_criteria),
    business_outcomes: frequencyList(value.business_outcomes),
    lost_reasons: frequencyList(value.lost_reasons),
    customer_objections: frequencyList(value.customer_objections),
    risks: frequencyList(value.risks),
    topics: frequencyList(value.topics),
    next_step_summary: nextStepSummary(value.next_step_summary),
    attention_calls: callEvidenceList(value.attention_calls),
    strong_calls: callEvidenceList(value.strong_calls)
  };

  return hasDefinedValue(result) ? result : undefined;
}

function scoreSummary(value: unknown): AggregateScoreSummary | undefined {
  if (!isRecord(value)) return undefined;

  const result: AggregateScoreSummary = {
    calls_with_score: numberValue(value.calls_with_score),
    average: numberValue(value.average),
    min: numberValue(value.min),
    max: numberValue(value.max),
    low_count: numberValue(value.low_count),
    medium_count: numberValue(value.medium_count),
    high_count: numberValue(value.high_count)
  };

  return hasDefinedValue(result) ? result : undefined;
}

function nextStepSummary(value: unknown): AggregateNextStepSummary | undefined {
  if (!isRecord(value)) return undefined;

  const result: AggregateNextStepSummary = {
    calls_with_next_step: numberValue(value.calls_with_next_step),
    calls_with_specific_next_step: numberValue(value.calls_with_specific_next_step),
    calls_missing_next_step: numberValue(value.calls_missing_next_step),
    calls_missing_specific_step: numberValue(value.calls_missing_specific_step),
    missing_next_step_share: shareValue(value.missing_next_step_share),
    missing_specific_step_share: shareValue(value.missing_specific_step_share)
  };

  return hasDefinedValue(result) ? result : undefined;
}

function frequencyList(value: unknown): AggregateFrequency[] {
  return recordList(value).map((item) => ({
    code: stringValue(item.code),
    title: stringValue(item.title),
    count: numberValue(item.count),
    share: shareValue(item.share),
    sample_call_uuids: stringList(item.sample_call_uuids)
  }));
}

function criterionMetricList(value: unknown): AggregateCriterionMetric[] {
  return recordList(value).map((item) => ({
    code: stringValue(item.code),
    title: stringValue(item.title),
    applicable_calls: numberValue(item.applicable_calls),
    weak_calls: numberValue(item.weak_calls),
    weak_share: shareValue(item.weak_share),
    average_points_share: shareValue(item.average_points_share),
    missed_calls: numberValue(item.missed_calls),
    partially_met_calls: numberValue(item.partially_met_calls),
    unclear_calls: numberValue(item.unclear_calls),
    sample_call_uuids: stringList(item.sample_call_uuids)
  }));
}

function callEvidenceList(value: unknown): AggregateCallEvidence[] {
  return recordList(value).map((item) => ({
    call_uuid: stringValue(item.call_uuid),
    created_at: stringValue(item.created_at),
    title: stringValue(item.title),
    score: numberValue(item.score),
    summary: stringValue(item.summary),
    issue_codes: stringList(item.issue_codes)
  }));
}

function findingList(value: unknown): AggregateFinding[] {
  return recordList(value).map((item) => ({
    title: stringValue(item.title),
    description: stringValue(item.description),
    severity: stringValue(item.severity),
    evidence_call_uuids: stringList(item.evidence_call_uuids),
    affected_calls_count: numberValue(item.affected_calls_count),
    affected_share: shareValue(item.affected_share)
  }));
}

function recurringIssueList(value: unknown): AggregateRecurringIssue[] {
  return recordList(value).map((item) => ({
    code: stringValue(item.code),
    title: stringValue(item.title),
    count: numberValue(item.count),
    recommendation: stringValue(item.recommendation),
    affected_share: shareValue(item.affected_share),
    sample_call_uuids: stringList(item.sample_call_uuids)
  }));
}

function issueDetailList(value: unknown): AggregateIssueDetail[] {
  return recordList(value).map((item) => ({
    code: stringValue(item.code),
    title: stringValue(item.title),
    description: stringValue(item.description) ?? stringValue(item.reason),
    affected_calls_count: numberValue(item.affected_calls_count),
    affected_share: shareValue(item.affected_share),
    severity: stringValue(item.severity),
    evidence_call_uuids: stringList(item.evidence_call_uuids),
    sample_call_uuids: stringList(item.sample_call_uuids),
    recommendation: stringValue(item.recommendation),
    business_impact: stringValue(item.business_impact),
    reason: stringValue(item.reason),
    count: numberValue(item.count)
  }));
}

function metricDetailList(value: unknown): AggregateMetricDetail[] {
  return recordList(value).map((item) => ({
    code: stringValue(item.code),
    title: stringValue(item.title),
    affected_calls_count: numberValue(item.affected_calls_count),
    affected_share: shareValue(item.affected_share),
    explanation: stringValue(item.explanation),
    recommendation: stringValue(item.recommendation),
    evidence_call_uuids: stringList(item.evidence_call_uuids)
  }));
}

function priorityActionList(value: unknown): AggregatePriorityAction[] {
  return recordList(value).map((item) => ({
    title: stringValue(item.title),
    priority: stringValue(item.priority),
    expected_effect: stringValue(item.expected_effect)
  }));
}

function detailedReport(value: unknown): AggregateDetailedReport | undefined {
  if (!isRecord(value)) return undefined;

  const result: AggregateDetailedReport = {
    methodology: stringValue(value.methodology),
    quality_overview: stringValue(value.quality_overview),
    issue_analysis: stringValue(value.issue_analysis),
    customer_loss_analysis: stringValue(value.customer_loss_analysis),
    training_plan: stringValue(value.training_plan),
    data_limitations: stringValue(value.data_limitations)
  };

  return hasDefinedValue(result) ? result : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordList(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const text = stringValue(item);
    return text ? [text] : [];
  });
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function shareValue(value: unknown) {
  const number = numberValue(value);
  return number !== undefined && number >= 0 && number <= 1 ? number : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function hasDefinedValue(value: object) {
  return Object.values(value).some((item) => item !== undefined);
}
