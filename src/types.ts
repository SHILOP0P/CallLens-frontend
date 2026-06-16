export type AppPage =
  | "overview"
  | "calls"
  | "upload"
  | "analysis"
  | "instructions"
  | "invitations"
  | "companies"
  | "profile"
  | "tariffs";
export type CallStatus = "new" | "processing" | "transcribed" | "analyzed" | "failed";
export type VisibilityScope = "personal" | "company" | "department";
export type InstructionScope = "personal" | "company" | "department";
export type InvitationStatus = "pending" | "accepted" | "declined" | "canceled" | "expired";
export type CompanyRole = "employee";
export type DepartmentRole = "employee" | "department_leader";
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

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  full_surname: string;
  nick_name: string;
  role: string;
  post?: string | null;
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
  nick_name: string;
  post?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CallResponse {
  id: string;
  title: string;
  status: CallStatus;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
  uploaded_by_user_uuid?: string | null;
  company_uuid?: string | null;
  department_uuid?: string | null;
  visibility_scope: VisibilityScope;
  created_at: string;
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

export interface CreateReportRequest {
  format: ReportFormat;
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
  file_path: string;
  mime_type: string;
  size_bytes: number;
  content_sha256: string;
  sort_order: number;
  is_active: boolean;
  created_by_user_uuid: string;
  created_at: string;
  updated_at: string;
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
