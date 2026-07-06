export type AppPage =
  | "overview"
  | "calls"
  | "analysis"
  | "reports"
  | "monitoring"
  | "settings"
  | "settingsTariffs"
  | "settingsCompanies"
  | "settingsInstructions"
  | "settingsInvitations"
  | "settingsProfile"
  | "settingsProfileEdit"
  | "settingsDevices"
  | "upload";
export type CallStatus = "new" | "processing" | "transcribed" | "analyzed" | "failed";
export type VisibilityScope = "personal" | "company" | "department";
export type InstructionScope = "personal" | "company" | "department";
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
  post?: string | null;
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
  post?: string;
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
}

export interface UpdateProfileRequest {
  full_name?: string;
  full_surname?: string;
  post?: string | null;
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
  recording_url?: string | null;
  download_url?: string | null;
  uploaded_by_user_uuid?: string | null;
  company_uuid?: string | null;
  department_uuid?: string | null;
  visibility_scope: VisibilityScope;
  use_custom_instructions?: boolean;
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
  language?: string | null;
  provider: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
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
  result_json: Record<string, unknown> | unknown[] | null;
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
  status: CriteriaStatus | string;
  points_awarded: number;
  points_max: number;
  evidence_quotes: string[];
  issue: string;
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
    has_next_step: boolean;
    specific: boolean;
    has_deadline: boolean;
    has_responsible_person: boolean;
  };
  business_outcome: {
    status: BusinessOutcomeStatus | string;
    summary: string;
    lost_reason: LostReason | string;
  };
  customer_signals: {
    intent: SignalLevel | string;
    urgency: SignalLevel | string;
    budget_discussed: boolean;
    decision_maker_present: boolean;
  };
  issue_codes: string[];
  evidence_quotes: string[];
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
  calls_new: number;
  calls_processing: number;
  calls_transcribed: number;
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
}

export interface UpdateCallFolderRequest {
  name?: string;
  description?: string | null;
  color?: string | null;
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

export interface AggregateAnalysisResult {
  summary: string;
  key_findings: Array<{
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | string;
    evidence_call_uuids: string[];
  }>;
  recurring_issues: Array<{
    code: string;
    title: string;
    count: number;
    recommendation: string;
  }>;
  strengths: string[];
  risks: string[];
  priority_actions: Array<{
    title: string;
    priority: "low" | "medium" | "high" | string;
    expected_effect: string;
  }>;
  manager_recommendations: string[];
  confidence: AnalysisConfidence | string;
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

export interface ListAggregateAnalysesResponse {
  items: AggregateAnalysisResponse[];
  total: number;
  limit: number;
  offset: number;
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
