export type AppPage =
  | "overview"
  | "calls"
  | "transcriptionEdit"
  | "transcriptionCompare"
  | "analysis"
  | "reports"
  | "contacts"
  | "monitoring"
  | "settings"
  | "settingsTariffs"
  | "settingsCompanies"
  | "settingsInstructions"
  | "settingsInvitations"
  | "profile"
  | "profileEdit"
  | "profileDevices"
  | "admin"
  | "upload";
export type CallStatus = "new" | "processing" | "transcribed" | "analyzed" | "failed";
export type VisibilityScope = "personal" | "company" | "department";
export type InstructionScope = "personal" | "company" | "department";
export type AnalysisPersonalizationScope = "personal" | "company" | "department";
export interface AnalysisPersonalization {
  scope: AnalysisPersonalizationScope;
  owner_uuid: string;
  content: string;
  updated_at?: string;
}
export type InvitationStatus = "pending" | "accepted" | "declined" | "canceled" | "expired";
export type CompanyRole = "employee";
export type DepartmentRole = "employee" | "department_leader";
export type MembershipStatus = "active" | "suspended" | "left";
export type InvitationCompanyRole = CompanyRole;
export type InvitationDepartmentRole = DepartmentRole;
export type PlanType = "personal" | "business";
export type PlanCode =
  | "personal_start"
  | "personal_plus"
  | "personal_pro"
  | "business_start"
  | "business_plus"
  | "business_pro";
export type AnalysisLevel = "basic" | "plus" | "pro" | "priority";
export type SubscriptionStatus = "active" | "canceled" | "expired";
export type ReportFormat = "pdf" | "docx" | "md" | "xlsx";
export type ReportStatus = "pending" | "ready" | "failed";
export type CriteriaStatus = "met" | "partially_met" | "missed" | "not_applicable" | "unclear";
export type BusinessOutcomeStatus =
  | "success"
  | "follow_up_needed"
  | "no_decision"
  | "lost"
  | "support_resolved"
  | "not_call"
  | "unclear";
export type LostReason =
  | "price"
  | "timing"
  | "no_need"
  | "competitor"
  | "no_next_step"
  | "unclear_value"
  | "bad_fit"
  | "not_applicable"
  | "unclear";
export type SignalLevel = "high" | "medium" | "low" | "unclear";
export type AnalysisConfidence = "low" | "medium" | "high";
export type DeepAnalysisScope = VisibilityScope | "folder";
export type AggregateAnalysisStatus = "pending" | "processing" | "done" | "failed";

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  full_surname: string;
  username: string;
  role: string;
  headline?: string | null;
  phone?: string | null;
  timezone?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: UserResponse;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  full_surname: string;
  username?: string;
  headline?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdatePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdatePasswordResponse {
  updated_at: string;
}

export interface UserSessionResponse {
  id: string;
  current: boolean;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export interface UserSessionsResponse {
  sessions: UserSessionResponse[];
  can_manage_other_sessions?: boolean;
  available_at?: string | null;
  retry_after_seconds?: number;
}

export interface AdminCapabilitiesResponse {
  role: "helper" | "admin" | "superadmin";
  permissions: string[];
}

export interface UpdateAdminUserProfileRequest {
  full_name?: string;
  full_surname?: string;
  username?: string;
  headline?: string;
  reason: string;
}

export interface AdminUsersResponse {
  items: UserResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminCompaniesResponse {
  items: CompanyResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminSubscriptionResponse {
  id: string;
  plan_code: PlanCode;
  type: PlanType;
  status: "active" | "canceled" | "expired";
  user_uuid: string | null;
  company_uuid: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  full_surname?: string;
  headline?: string | null;
  phone?: string | null;
  timezone?: string | null;
}

export interface AvatarResponse {
  avatar_url: string;
  updated_at: string;
}

export interface PreferencesDateRange {
  from?: string | null;
  to?: string | null;
}

export interface UserPreferencesResponse {
  active_company_uuid: string | null;
  theme: "system" | "light" | "dark";
  date_range: PreferencesDateRange;
}

export interface UpdatePreferencesRequest {
  active_company_uuid?: string | null;
  theme?: "system" | "light" | "dark";
  date_range?: PreferencesDateRange;
}

export interface CallResponse {
  id: string;
  title: string;
  status: CallStatus;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
  audio_url?: string | null;
  audio_download_url?: string | null;
  file_url?: string | null;
  media_url?: string | null;
  media_kind?: "audio" | "video" | null;
  recording_url?: string | null;
  download_url?: string | null;
  uploaded_by_user_uuid?: string | null;
  company_uuid?: string | null;
  department_uuid?: string | null;
  visibility_scope: VisibilityScope;
  use_custom_instructions?: boolean;
  speaker_hints?: Array<{ user_id: string; name: string; username?: string; role: "self" | "manager" | "client" | "other"; note?: string }>;
  diarization_roles?: Array<{ name: string; description?: string }>;
  is_favorite?: boolean;
  created_at: string;
}

export interface CallsListResponse {
  items: CallResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface CallFilterOptionsResponse {
  statuses: string[];
  scopes: string[];
  managers: Array<{
    id: string;
    full_name: string;
    full_surname: string;
    username: string;
  }>;
}

export interface CallStatusEvent {
  call_id: string;
  status: CallStatus;
  terminal: boolean;
  timestamp: string;
}

export interface TranscriptionResponse {
  id: string;
  call_uuid: string;
  status: "processing" | "transcribed" | "failed" | string;
  text?: string | null;
  segments?: TranscriptionSegmentResponse[];
  words: TranscriptionWordResponse[];
  language?: string | null;
  provider: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  revision?: number;
  edited?: boolean;
  editable?: boolean;
  editability_reason?: string;
}

export interface TranscriptionWordEdit {
  word_index: number;
  text?: string;
  speaker?: string;
}

export type TranscriptionSpeakerRole = "unknown" | "client" | "manager" | "operator" | "partner" | "other";

export interface TranscriptionSpeakerAssignment {
  speaker_key: string;
  display_name: string;
  role: TranscriptionSpeakerRole;
  custom_role?: string;
  contact_user_uuid?: string;
}

export interface UpdateTranscriptionRequest {
  expected_revision: number;
  reason: string;
  edits: TranscriptionWordEdit[];
}

export interface TranscriptionUpdateResponse {
  transcription: TranscriptionResponse;
  revision: number;
  reason: string;
  changed_word_indexes: number[];
}

export interface TranscriptionRevisionSummary {
  id: string;
  call_uuid: string;
  revision: number;
  reason: string;
  changed_word_indexes: number[];
  created_at: string;
  is_current: boolean;
}

export interface TranscriptionRevisionListResponse {
  items: TranscriptionRevisionSummary[];
  total: number;
}

export interface TranscriptionRevisionContent {
  revision: number;
  is_current: boolean;
  text: string;
  segments: TranscriptionSegmentResponse[];
  words: TranscriptionWordResponse[];
}

export interface TranscriptionWordResponse {
  text: string;
  start_seconds: number;
  end_seconds: number;
  confidence?: number | null;
  speaker?: string;
}

export type AnalysisEvidenceMatchStatus = "matched" | "ambiguous" | "not_found" | "legacy";

export interface AnalysisEvidence {
  quote: string;
  start_seconds?: number;
  end_seconds?: number;
  word_start_index?: number;
  word_end_index?: number;
  speaker?: string;
  match_status: AnalysisEvidenceMatchStatus | string;
}

export interface MediaSeekTarget {
  startSeconds: number;
  endSeconds?: number;
  wordStartIndex?: number;
  wordEndIndex?: number;
}

export interface TranscriptionSegmentResponse {
  speaker: string;
  start_seconds?: number | null;
  end_seconds?: number | null;
  text: string;
}

export interface AnalysisResponse {
  id: string;
  call_uuid: string;
  status: "pending" | "processing" | "done" | "failed" | string;
  provider: string;
  model?: string | null;
  result_json: Record<string, unknown> | unknown[] | string | null;
  result_text?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisV2Question {
  question: string;
  manager_answer: string;
  answer_status: "answered" | "partially_answered" | "not_answered" | "unclear" | string;
  evidence_quotes: string[];
  evidence: AnalysisEvidence[];
}

export interface AnalysisV2CriteriaResult {
  code:
    | "greeting"
    | "needs_discovery"
    | "question_quality"
    | "answer_quality"
    | "solution_relevance"
    | "objection_handling"
    | "pricing_clarity"
    | "tone_professionalism"
    | "next_step_quality"
    | "outcome_clarity"
    | "custom_instruction_match"
    | string;
  title: string;
  topic: string;
  status: CriteriaStatus | string;
  points_awarded: number;
  points_max: number;
  score: number;
  quote: string;
  evidence_quotes: string[];
  evidence: AnalysisEvidence[];
  issue: string;
  explanation: string;
  recommendation: string;
}

export interface AnalysisV2Result {
  schema_version: 2;
  summary: string;
  topics: string[];
  dialogue_tone: {
    overall: string;
    manager: string;
    client: string;
    evidence_quotes: string[];
    evidence: AnalysisEvidence[];
  };
  client_questions: AnalysisV2Question[];
  question_coverage: {
    status: "answered" | "partially_answered" | "not_answered" | "no_questions" | "unclear" | string;
    summary: string;
    unanswered_questions: string[];
  };
  manager_quality: {
    strengths: string[];
    issues: string[];
    recommendations: string[];
  };
  call_outcome: string;
  score: number;
  score_scale: number;
  score_breakdown: {
    points_awarded: number;
    points_possible: number;
    applicable_criteria_count: number;
    total_criteria_count: number;
  };
  criteria_results: AnalysisV2CriteriaResult[];
  customer_objections: string[];
  risks: string[];
  next_steps: string[];
  next_step: string;
  next_step_quality: {
    has_next_step: boolean | null;
    specific: boolean | null;
    has_deadline: boolean | null;
    has_responsible_person: boolean | null;
  };
  business_outcome: {
    status: BusinessOutcomeStatus | string;
    summary: string;
    lost_reason: LostReason | string;
  };
  customer_signals: {
    intent: SignalLevel | string;
    urgency: SignalLevel | string;
    budget_discussed: boolean | null;
    decision_maker_present: boolean | null;
  };
  issue_codes: string[];
  evidence_quotes: string[];
  evidence: AnalysisEvidence[];
  confidence: AnalysisConfidence | string;
}

export interface CreateReportRequest {
  format: ReportFormat;
}

export interface CreateGlobalReportRequest {
  format: ReportFormat;
  scope: "call" | "company" | "department" | "manager" | "period";
  call_uuid?: string | null;
  company_uuid?: string | null;
  department_uuid?: string | null;
  manager_user_uuid?: string | null;
  period_from?: string | null;
  period_to?: string | null;
}

export interface ReportResponse {
  id: string;
  call_uuid: string;
  analysis_uuid: string;
  requested_by_user_uuid: string;
  format: ReportFormat;
  status: ReportStatus;
  file_name: string;
  content_type: string;
  size_bytes: number;
  error_message: string | null;
  download_url: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface ReportsResponse {
  reports: ReportResponse[];
}

export interface ReportCallSummaryResponse {
  id: string;
  title: string;
  status: string;
  created_at: string;
  company_uuid: string | null;
  department_uuid: string | null;
}

export type ReportWithCallResponse = ReportResponse & {
  call: ReportCallSummaryResponse;
};

export interface GlobalReportsResponse {
  reports: ReportWithCallResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface CompanyResponse {
  id: string;
  name: string;
  tag?: string;
  manager_user_uuid: string;
  member_limit: number;
  created_at: string;
}

export interface DepartmentResponse {
  id: string;
  company_uuid: string;
  name: string;
  created_at: string;
}

export interface DepartmentMemberResponse {
  department_uuid: string;
  user_uuid: string;
  full_name?: string;
  full_surname?: string;
  username?: string;
  job_title: string | null;
  role: DepartmentRole;
  status: MembershipStatus;
  created_at: string;
}

export interface Invitation {
  id: string;
  company_uuid: string;
  department_uuid: string | null;
  invited_user_uuid: string;
  invited_by_user_uuid: string;
  company_role: CompanyRole;
  department_role: DepartmentRole | null;
  status: InvitationStatus;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisInstruction {
  id: string;
  scope: InstructionScope;
  user_uuid?: string | null;
  company_uuid?: string | null;
  department_uuid?: string | null;
  title: string;
  original_filename: string;
  download_url: string;
  mime_type: string;
  size_bytes: number;
  content_sha256: string;
  sort_order: number;
  is_active: boolean;
  created_by_user_uuid: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsageResponse {
  subscription: Subscription;
  period_start: string;
  period_end: string;
  used_minutes: number;
  limit_minutes: number;
  remaining_minutes: number;
  percent: number;
  members_limit?: number;
  members_used?: number;
  departments_limit?: number;
  departments_used?: number;
  active_instructions_limit?: number;
  active_instructions_used?: number;
}

export interface AnalyticsOverviewResponse {
  calls_total: number;
  calls_created_today: number;
  calls_new: number;
  calls_processing: number;
  calls_transcribed: number;
  calls_with_transcription: number;
  calls_analyzed: number;
  calls_failed: number;
  average_duration_seconds: number | null;
  average_quality_score: number | null;
  quality_score_scale: number;
  average_score?: number | null;
  score_scale?: number;
  score_distribution?: {
    critical: number;
    weak: number;
    normal: number;
    good: number;
    excellent: number;
  };
  criteria_summary?: Array<{
    code: string;
    title: string;
    average_score: number | null;
    met: number;
    partially_met: number;
    missed: number;
    unclear: number;
    not_applicable: number;
    calls_count: number;
  }>;
  top_weak_criteria?: Array<{
    code: string;
    title: string;
    average_score: number | null;
    missed_count: number;
    partially_met_count: number;
  }>;
  top_issue_codes?: Array<{ code: string; count: number }>;
  business_outcomes?: Array<{ status: string; count: number }>;
  next_step_summary?: {
    with_next_step: number;
    specific: number;
    with_deadline: number;
    with_responsible_person: number;
    missing: number;
  };
  top_topics: Array<{ title: string; count: number }>;
  risks_count: number | null;
  recommendations_count: number | null;
  charts: {
    calls_by_day: Array<{ date: string; count: number }>;
    analyzed_by_day: Array<{ date: string; count: number }>;
    quality_by_day: Array<{ date: string; average_quality_score: number }>;
    score_by_day?: Array<{ date: string; average_score: number }>;
    duration_by_day: Array<{ date: string; average_duration_seconds: number }>;
    risks_by_day: Array<{ date: string; count: number }>;
  };
}

export interface CallFolderResponse {
  id: string;
  scope: VisibilityScope | string;
  user_uuid: string | null;
  company_uuid: string | null;
  department_uuid: string | null;
  name: string;
  description: string | null;
  color: string | null;
  calls_count: number;
  created_by_user_uuid: string;
  created_at: string;
  updated_at: string;
  instructions: AnalysisInstruction[];
}

export interface CallFoldersListResponse {
  items: CallFolderResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateCallFolderRequest {
  scope: VisibilityScope;
  company_uuid?: string | null;
  department_uuid?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  instruction_uuids?: string[];
}

export interface UpdateCallFolderRequest {
  name?: string;
  description?: string | null;
  color?: string | null;
  instruction_uuids?: string[];
}

export interface AssignCallToFolderRequest {
  call_uuid: string;
}

export interface CreateDeepAnalysisRequest {
  scope: DeepAnalysisScope;
  company_uuid?: string | null;
  department_uuid?: string | null;
  folder_uuid?: string | null;
  period_from: string;
  period_to: string;
  force: boolean;
}

export type AggregateSeverity = "low" | "medium" | "high" | string;
export type AggregatePriority = "low" | "medium" | "high" | string;
export type AggregateConfidence = "low" | "medium" | "high" | string;

/**
 * Deep-analysis JSON is generated asynchronously and may contain older result
 * versions. Optional fields deliberately keep the renderer tolerant of partial
 * historical payloads.
 */
export interface AggregateSourceSummary {
  analyzed_calls?: number;
  included_in_statistics?: number;
  representative_calls?: number;
  all_analyzed_calls_used?: boolean;
  source_set_hash?: string;
}

export interface AggregateFrequency {
  code?: string;
  title?: string;
  count?: number;
  share?: number;
  sample_call_uuids?: string[];
}

export interface AggregateScoreSummary {
  calls_with_score?: number;
  average?: number | null;
  min?: number | null;
  max?: number | null;
  low_count?: number;
  medium_count?: number;
  high_count?: number;
}

export interface AggregateCriterionMetric {
  code?: string;
  title?: string;
  applicable_calls?: number;
  weak_calls?: number;
  weak_share?: number;
  average_points_share?: number | null;
  missed_calls?: number;
  partially_met_calls?: number;
  unclear_calls?: number;
  sample_call_uuids?: string[];
}

export interface AggregateNextStepSummary {
  calls_with_next_step?: number;
  calls_with_specific_next_step?: number;
  calls_missing_next_step?: number;
  calls_missing_specific_step?: number;
  missing_next_step_share?: number;
  missing_specific_step_share?: number;
}

export interface AggregateCallEvidence {
  call_uuid?: string;
  created_at?: string;
  title?: string;
  score?: number | null;
  summary?: string;
  issue_codes?: string[];
}

export interface AggregateStatistics {
  score_summary?: AggregateScoreSummary;
  issue_coverage?: AggregateFrequency[];
  weak_criteria?: AggregateCriterionMetric[];
  business_outcomes?: AggregateFrequency[];
  lost_reasons?: AggregateFrequency[];
  customer_objections?: AggregateFrequency[];
  risks?: AggregateFrequency[];
  topics?: AggregateFrequency[];
  next_step_summary?: AggregateNextStepSummary;
  attention_calls?: AggregateCallEvidence[];
  strong_calls?: AggregateCallEvidence[];
}

export interface AggregateFinding {
  title?: string;
  description?: string;
  severity?: AggregateSeverity;
  evidence_call_uuids?: string[];
  affected_calls_count?: number;
  affected_share?: number;
}

export interface AggregateRecurringIssue {
  code?: string;
  title?: string;
  count?: number;
  recommendation?: string;
  affected_share?: number;
  sample_call_uuids?: string[];
}

export interface AggregateIssueDetail {
  code?: string;
  title?: string;
  description?: string;
  affected_calls_count?: number;
  affected_share?: number;
  severity?: AggregateSeverity;
  evidence_call_uuids?: string[];
  sample_call_uuids?: string[];
  recommendation?: string;
  business_impact?: string;
  reason?: string;
  count?: number;
}

export interface AggregateMetricDetail {
  code?: string;
  title?: string;
  affected_calls_count?: number;
  affected_share?: number;
  explanation?: string;
  recommendation?: string;
  evidence_call_uuids?: string[];
}

export interface AggregatePriorityAction {
  title?: string;
  priority?: AggregatePriority;
  expected_effect?: string;
}

export interface AggregateDetailedReport {
  methodology?: string;
  quality_overview?: string;
  issue_analysis?: string;
  customer_loss_analysis?: string;
  training_plan?: string;
  data_limitations?: string;
}

export interface AggregateAnalysisResult {
  summary: string;
  aggregate_schema_version?: number;
  executive_summary?: string;
  overall_assessment?: string;
  source_summary?: AggregateSourceSummary;
  aggregate_statistics?: AggregateStatistics;
  coverage_note?: string;
  key_findings: AggregateFinding[];
  recurring_issues: AggregateRecurringIssue[];
  systemic_issues?: AggregateIssueDetail[];
  single_call_observations?: AggregateIssueDetail[];
  weak_criteria?: AggregateMetricDetail[];
  client_objections?: AggregateMetricDetail[];
  loss_and_risk_patterns?: AggregateIssueDetail[];
  strengths: string[];
  risks: string[];
  priority_actions: AggregatePriorityAction[];
  manager_recommendations: string[];
  confidence: AggregateConfidence;
  detailed_report?: AggregateDetailedReport;
}

export interface AggregateAnalysisResponse {
  id: string;
  scope: DeepAnalysisScope | string;
  user_uuid?: string | null;
  company_uuid: string | null;
  department_uuid: string | null;
  folder_uuid: string | null;
  period_from: string;
  period_to: string;
  status: AggregateAnalysisStatus | string;
  provider: string;
  model: string | null;
  source_calls_count: number;
  result_json: AggregateAnalysisResult | Record<string, unknown> | unknown[] | null;
  result_text: string | null;
  error_message: string | null;
  created_by_user_uuid: string;
  created_at: string;
  updated_at: string;
}

export interface AggregateAnalysisStatusEvent {
  analysis_id: string;
  status: AggregateAnalysisStatus | string;
  terminal: boolean;
  timestamp: string;
}

export interface ListAggregateAnalysesResponse {
  items: AggregateAnalysisResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListDeepAnalysesQuery {
  scope?: DeepAnalysisScope;
  company_uuid?: string;
  department_uuid?: string;
  folder_uuid?: string;
  from?: string;
  to?: string;
  status?: AggregateAnalysisStatus;
  limit?: number;
  offset?: number;
}

export interface CreateAggregateReportRequest {
  format: ReportFormat;
}

export interface AggregateReportResponse {
  id: string;
  aggregate_analysis_uuid: string;
  requested_by_user_uuid: string;
  format: ReportFormat | string;
  status: ReportStatus | string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  error_message: string | null;
  download_url: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface ListAggregateReportsResponse {
  reports: AggregateReportResponse[];
}

export interface ProcessingMonitoringResponse {
  queue: {
    pending: number;
    running: number;
    done: number;
    failed: number;
    retry: number;
  };
  average_processing_seconds: number | null;
}

export interface CompanyMemberDepartmentResponse {
  department_uuid: string;
  department_name: string;
  role: string;
  status: string;
}

export interface CompanyMemberListItemResponse {
  user_uuid: string;
  email: string;
  username: string;
  full_name: string;
  full_surname: string;
  job_title: string | null;
  company_role: string;
  status: string;
  departments: CompanyMemberDepartmentResponse[];
  created_at: string;
}

export interface CompanyMembersResponse {
  members: CompanyMemberListItemResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchResponse {
  calls: Array<{ id: string; title: string; status: string; created_at: string }>;
  companies: Array<{ id: string; name: string }>;
  reports: Array<{ id: string; call_uuid: string; file_name: string; status: string }>;
  instructions: Array<{ id: string; title: string; scope: string }>;
}

export interface NotificationResponse {
  id: string;
  type: "invitation" | "report_ready" | "subscription" | "processing_failed" | string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_uuid: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: NotificationResponse[];
  unread_count: number;
}

export interface Plan {
  id: string;
  code: PlanCode;
  type: PlanType;
  name: string;
  monthly_minutes_limit: number;
  active_instruction_limit: number;
  company_limit: number | null;
  departments_per_company_limit: number | null;
  members_per_company_limit: number | null;
  instructions_per_department_limit: number | null;
  analysis_level: AnalysisLevel;
  history_retention_days: number;
  export_enabled: boolean;
  team_analytics_enabled: boolean;
  api_access_enabled: boolean;
}

export interface PlansResponse {
  plans: Plan[];
}

export interface Subscription {
  id: string;
  plan: Plan;
  user_uuid: string | null;
  company_uuid: string | null;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionState {
  user: UserResponse;
}
