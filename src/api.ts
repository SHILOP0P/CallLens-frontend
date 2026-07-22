import type {
  AggregateAnalysisResponse,
  AdminCapabilitiesResponse,
  AdminCompaniesResponse,
  AdminSubscriptionResponse,
  AdminUsersResponse,
  AggregateReportResponse,
  AnalysisInstruction,
  AnalysisResponse,
  AuthResponse,
  AnalyticsOverviewResponse,
  AvatarResponse,
  CallFilterOptionsResponse,
  CallFoldersListResponse,
  CallFolderResponse,
  CallResponse,
  CallStatus,
  CallsListResponse,
  CompanyResponse,
  CompanyMemberListItemResponse,
  CompanyMembersResponse,
  DepartmentMemberResponse,
  CreateCallFolderRequest,
  CreateDeepAnalysisRequest,
  CreateAggregateReportRequest,
  CreateGlobalReportRequest,
  CreateReportRequest,
  DepartmentResponse,
  GlobalReportsResponse,
  Invitation,
  InvitationDepartmentRole,
  InvitationStatus,
  InstructionScope,
  PromptIndustry,
  PromptPerspective,
  PromptProfile,
  PromptUserSettings,
  PromptTopic,
  ListAggregateAnalysesResponse,
  ListAggregateReportsResponse,
  ListDeepAnalysesQuery,
  LoginRequest,
  NotificationResponse,
  NotificationsResponse,
  Plan,
  PlanCode,
  PlanType,
  PlansResponse,
  ProcessingMonitoringResponse,
  RegisterRequest,
  ReportFormat,
  ReportResponse,
  ReportStatus,
  ReportsResponse,
  SearchResponse,
  Subscription,
  SubscriptionUsageResponse,
  TranscriptionResponse,
  UpdateCallFolderRequest,
  UpdatePasswordRequest,
  UpdatePasswordResponse,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
  UserPreferencesResponse,
  UserResponse,
  UserSessionsResponse,
  VisibilityScope
} from "./types";
import { AuthorizedEventStream } from "./shared/lib/authorized-event-stream";
import { coordinateRefresh } from "./features/auth/refresh-coordinator";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const apiRoot = `${configuredBase}/api/v1`;
const authRefreshPath = "/auth/refresh";
const sessionExpiredEvent = "calllens:session-expired";

function notifySessionExpired() {
  window.dispatchEvent(new Event(sessionExpiredEvent));
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const apiErrorMessages: Record<string, string> = {
  subscription_required: "Требуется активная подписка",
  subscription_not_found: "Подписка не найдена",
  invalid_billing_input: "Некорректные данные подписки",
  failed_to_activate_subscription: "Не удалось активировать подписку",
  failed_to_cancel_subscription: "Не удалось отменить подписку",
  failed_to_convert_subscription: "Не удалось обработать данные подписки",
  failed_to_list_plans: "Не удалось загрузить тарифы",
  failed_to_convert_plan: "Не удалось обработать тарифы",
  plan_limit_exceeded: "Лимит тарифа исчерпан",
  monthly_minutes_limit_exceeded: "Месячный лимит минут исчерпан",
  instruction_limit_exceeded: "Лимит активных инструкций исчерпан",
  company_limit_exceeded: "Лимит компаний исчерпан",
  department_limit_exceeded: "Лимит отделов исчерпан",
  member_limit_exceeded: "Лимит сотрудников исчерпан",
  forbidden: "Недостаточно прав",
  unauthorized: "Необходимо войти в аккаунт",
  invalid_request_body: "Некорректное тело запроса",
  invalid_user_input: "Некорректный username",
  user_already_exists: "Этот username уже занят",
  company_not_found: "Компания не найдена",
  department_not_found: "Отдел не найден",
  user_not_found: "Пользователь не найден",
  invalid_department_input: "Некорректные данные отдела",
  failed_to_create_department: "Не удалось создать отдел",
  failed_to_list_department_members: "Не удалось загрузить работников отдела",
  failed_to_update_department_member: "Не удалось обновить работника отдела",
  failed_to_convert_department: "Не удалось обработать данные отдела",
  invitation_not_found: "Приглашение не найдено",
  invalid_invitation_input: "Некорректные данные приглашения",
  invitation_already_exists: "Такое приглашение уже ожидает ответа",
  invitation_not_pending: "Это приглашение уже обработано",
  invitation_expired: "Срок действия приглашения истек",
  failed_to_create_invitation: "Не удалось создать приглашение",
  failed_to_list_invitations: "Не удалось загрузить приглашения",
  failed_to_accept_invitation: "Не удалось принять приглашение",
  failed_to_decline_invitation: "Не удалось отклонить приглашение",
  failed_to_cancel_invitation: "Не удалось отменить приглашение",
  failed_to_convert_invitation: "Не удалось обработать данные приглашения",
  call_not_found: "Звонок не найден",
  analysis_not_found: "Для этого звонка еще нет анализа.",
  invalid_analysis_status: "Анализ еще не готов. Экспорт станет доступен после завершения анализа.",
  export_access_denied: "Экспорт отчетов недоступен на текущем тарифе.",
  unsupported_report_format: "Этот формат экспорта не поддерживается.",
  report_not_found: "Отчет не найден.",
  report_already_exists: "Отчет этого формата уже создан или формируется. Используйте запись в списке ниже.",
  report_file_not_found: "Файл отчета недоступен",
  report_not_ready: "Отчет еще формируется.",
  report_expired: "Срок хранения отчета истек",
  failed_to_create_report: "Не удалось создать отчет",
  failed_to_list_reports: "Не удалось загрузить отчеты",
  failed_to_download_report: "Не удалось скачать отчет",
  failed_to_delete_report: "Не удалось удалить отчет",
  team_analytics_access_denied: "Командная аналитика недоступна на текущем тарифе",
  api_access_denied: "API-доступ недоступен на текущем тарифе",
  invalid_search_input: "Введите минимум 2 символа для поиска",
  notification_not_found: "Уведомление не найдено",
  failed_to_list_notifications: "Не удалось загрузить уведомления",
  failed_to_mark_notification_read: "Не удалось отметить уведомление",
  failed_to_mark_all_notifications_read: "Не удалось отметить уведомления",
  failed_to_get_subscription_usage: "Не удалось загрузить лимиты подписки",
  failed_to_list_call_filters: "Не удалось загрузить фильтры звонков",
  failed_to_get_analytics_overview: "Не удалось загрузить аналитику",
  failed_to_get_processing_monitoring: "Не удалось загрузить мониторинг",
  not_implemented: "Эта возможность пока не реализована на backend",
  audio_file_not_found: "Аудиофайл недоступен",
  instruction_file_not_found: "Файл инструкции недоступен",
  invalid_call_folder_input: "Некорректные данные папки звонков",
  call_folder_not_found: "Папка звонков не найдена",
  call_folder_scope_mismatch: "Звонок не подходит для выбранной папки по области доступа.",
  failed_to_create_call_folder: "Не удалось создать папку звонков",
  failed_to_list_call_folders: "Не удалось загрузить папки звонков",
  failed_to_update_call_folder: "Не удалось обновить папку звонков",
  failed_to_delete_call_folder: "Не удалось удалить папку звонков",
  failed_to_assign_call_folder: "Не удалось добавить звонок в папку",
  failed_to_remove_call_folder: "Не удалось убрать звонок из папки",
  invalid_deep_analysis_input: "Некорректные параметры глубокого анализа",
  aggregate_analysis_not_found: "Глубокий анализ не найден",
  no_analyzed_calls_for_deep_analysis: "За выбранный период нет звонков с готовым анализом.",
  deep_analysis_limit_exceeded: "Лимит глубокого анализа на эту неделю исчерпан.",
  failed_to_create_deep_analysis: "Не удалось создать глубокий анализ",
  failed_to_list_deep_analyses: "Не удалось загрузить глубокие анализы",
  failed_to_get_deep_analysis: "Не удалось получить глубокий анализ",
  aggregate_report_not_found: "Отчет глубокого анализа не найден",
  invalid_aggregate_report_input: "Некорректные параметры отчета глубокого анализа",
  invalid_aggregate_analysis_status: "Отчет можно создать только после готового глубокого анализа.",
  aggregate_report_file_not_found: "Файл отчета глубокого анализа недоступен или срок хранения истек.",
  failed_to_create_aggregate_report: "Не удалось создать отчет глубокого анализа",
  failed_to_list_aggregate_reports: "Не удалось загрузить отчеты глубокого анализа",
  failed_to_download_aggregate_report: "Не удалось скачать отчет глубокого анализа",
  failed_to_delete_aggregate_report: "Не удалось удалить отчет глубокого анализа"
};

type ApiPayload = Record<string, unknown>;
type RawPlan = Partial<Plan> & {
  active_instructions_limit?: number;
  companies_limit?: number | null;
  departments_limit?: number | null;
  members_limit?: number | null;
  call_history_days?: number;
  export_reports_enabled?: boolean;
};

type RawSubscription = Omit<Partial<Subscription>, "plan"> & {
  plan?: RawPlan;
};

type RawSubscriptionUsageResponse = Omit<Partial<SubscriptionUsageResponse>, "subscription"> & {
  subscription?: RawSubscription;
};

function isRecord(value: unknown): value is ApiPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getApiErrorCode(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return typeof payload.error.code === "string" ? payload.error.code : undefined;
}

function getApiErrorDetails(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error) || !isRecord(payload.error.details)) return undefined;
  return payload.error.details;
}

function getApiErrorMessage(payload: unknown, status: number, path: string, init: RequestInit) {
  const code = getApiErrorCode(payload);

  if (code && apiErrorMessages[code]) return apiErrorMessages[code];

  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return `HTTP ${status}`;
}

function numberOrFallback(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function booleanOrFallback(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function analysisLevelOrFallback(value: unknown) {
  return value === "basic" || value === "plus" || value === "pro" || value === "priority"
    ? value
    : "basic";
}

function normalizePlan(plan: RawPlan): Plan {
  return {
    id: typeof plan.id === "string" ? plan.id : "",
    code: (typeof plan.code === "string" ? plan.code : "personal_start") as PlanCode,
    type: (plan.type === "business" ? "business" : "personal") as PlanType,
    name: typeof plan.name === "string" ? plan.name : "Тариф",
    monthly_minutes_limit: numberOrFallback(plan.monthly_minutes_limit),
    active_instruction_limit: numberOrFallback(
      plan.active_instruction_limit ?? plan.active_instructions_limit
    ),
    company_limit: nullableNumber(plan.company_limit ?? plan.companies_limit),
    departments_per_company_limit: nullableNumber(
      plan.departments_per_company_limit ?? plan.departments_limit
    ),
    members_per_company_limit: nullableNumber(plan.members_per_company_limit ?? plan.members_limit),
    instructions_per_department_limit: nullableNumber(plan.instructions_per_department_limit),
    analysis_level: analysisLevelOrFallback(plan.analysis_level),
    history_retention_days: numberOrFallback(plan.history_retention_days ?? plan.call_history_days),
    export_enabled: booleanOrFallback(plan.export_enabled ?? plan.export_reports_enabled),
    team_analytics_enabled: booleanOrFallback(plan.team_analytics_enabled),
    api_access_enabled: booleanOrFallback(plan.api_access_enabled)
  };
}

function normalizeSubscription(subscription: RawSubscription): Subscription {
  return {
    id: typeof subscription.id === "string" ? subscription.id : "",
    plan: normalizePlan(subscription.plan ?? {}),
    user_uuid: typeof subscription.user_uuid === "string" ? subscription.user_uuid : null,
    company_uuid: typeof subscription.company_uuid === "string" ? subscription.company_uuid : null,
    status: subscription.status === "canceled" ? "canceled" : subscription.status === "active" ? "active" : "expired",
    starts_at: typeof subscription.starts_at === "string" ? subscription.starts_at : "",
    ends_at: typeof subscription.ends_at === "string" ? subscription.ends_at : null,
    created_at: typeof subscription.created_at === "string" ? subscription.created_at : "",
    updated_at: typeof subscription.updated_at === "string" ? subscription.updated_at : ""
  };
}

function normalizeSubscriptionUsage(usage: RawSubscriptionUsageResponse): SubscriptionUsageResponse {
  return {
    subscription: normalizeSubscription(usage.subscription ?? {}),
    period_start: typeof usage.period_start === "string" ? usage.period_start : "",
    period_end: typeof usage.period_end === "string" ? usage.period_end : "",
    used_minutes: numberOrFallback(usage.used_minutes),
    limit_minutes: numberOrFallback(usage.limit_minutes),
    remaining_minutes: numberOrFallback(usage.remaining_minutes),
    percent: numberOrFallback(usage.percent),
    members_limit: typeof usage.members_limit === "number" ? usage.members_limit : undefined,
    members_used: typeof usage.members_used === "number" ? usage.members_used : undefined,
    departments_limit: typeof usage.departments_limit === "number" ? usage.departments_limit : undefined,
    departments_used: typeof usage.departments_used === "number" ? usage.departments_used : undefined,
    active_instructions_limit:
      typeof usage.active_instructions_limit === "number" ? usage.active_instructions_limit : undefined,
    active_instructions_used:
      typeof usage.active_instructions_used === "number" ? usage.active_instructions_used : undefined
  };
}

function refreshSessionRequest() {
  return coordinateRefresh({
    refresh: () => request<AuthResponse>(authRefreshPath, { method: "POST" }, { retryOnUnauthorized: false }),
    probe: async () => {
      try {
        return await request<UserResponse>("/auth/me", {}, { retryOnUnauthorized: false });
      } catch {
        return null;
      }
    },
    isConflict: (error) => error instanceof ApiError && error.status === 409 && error.code === "refresh_rotation_conflict"
  });
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { retryOnUnauthorized?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && options.retryOnUnauthorized !== false && !path.startsWith("/auth/")) {
      try {
        await refreshSessionRequest();
        return request<T>(path, init, { retryOnUnauthorized: false });
      } catch {
        // Keep the original unauthorized error for the caller.
      }
    }

    if (response.status === 401 && !path.startsWith("/auth/")) notifySessionExpired();

    const code = getApiErrorCode(payload);
    const message = getApiErrorMessage(payload, response.status, path, init);

    throw new ApiError(response.status, message, code, getApiErrorDetails(payload));
  }

  return payload as T;
}

async function requestBlob(path: string, options: { retryOnUnauthorized?: boolean } = {}): Promise<Blob> {
  const response = await fetch(`${apiRoot}${path}`, {
    credentials: "include"
  });

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    const code = getApiErrorCode(payload);
    const message = getApiErrorMessage(payload, response.status, path, {});

    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      try {
        await refreshSessionRequest();
        return requestBlob(path, { retryOnUnauthorized: false });
      } catch {
        // Keep the original unauthorized error for the caller.
      }
    }

    if (response.status === 401) notifySessionExpired();

    throw new ApiError(response.status, message, code, getApiErrorDetails(payload));
  }

  return response.blob();
}

async function requestAssetBlob(url: string, options: { retryOnUnauthorized?: boolean } = {}): Promise<Blob> {
  const response = await fetch(url, {
    credentials: "include"
  });

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    const code = getApiErrorCode(payload);
    const message = getApiErrorMessage(payload, response.status, url, {});

    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      try {
        await refreshSessionRequest();
        return requestAssetBlob(url, { retryOnUnauthorized: false });
      } catch {
        // Keep the original unauthorized error for the caller.
      }
    }

    if (response.status === 401) notifySessionExpired();

    throw new ApiError(response.status, message, code, getApiErrorDetails(payload));
  }

  return response.blob();
}

function absoluteApiAssetUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${configuredBase}${value}`;
  return value;
}

function queryString(input: object = {}) {
  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
      return;
    }
    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

function apiPathFromUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("/api/v1/")) return pathOrUrl.slice("/api/v1".length);
  if (!pathOrUrl.startsWith("/")) return `/${pathOrUrl}`;
  return pathOrUrl;
}

export function getCallMediaUrl(call: CallResponse) {
  const callWithAudioLinks = call as CallResponse & {
    audio_url?: string | null;
    audio_download_url?: string | null;
    file_url?: string | null;
    media_url?: string | null;
    recording_url?: string | null;
    download_url?: string | null;
  };
  const directUrl = [
    callWithAudioLinks.media_url,
    callWithAudioLinks.audio_url,
    callWithAudioLinks.audio_download_url,
    callWithAudioLinks.file_url,
    callWithAudioLinks.recording_url,
    callWithAudioLinks.download_url
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (directUrl) return absoluteApiAssetUrl(directUrl);

  return `${apiRoot}/calls/${encodeURIComponent(call.id)}/media`;
}

export function getCallMediaBlob(call: CallResponse) {
  return requestAssetBlob(getCallMediaUrl(call));
}

export const getCallAudioUrl = getCallMediaUrl;
export const getCallAudioBlob = getCallMediaBlob;

export function getAdminCallAudioBlob(callId: string) {
  return requestBlob(`/admin/calls/${encodeURIComponent(callId)}/audio`);
}

export function openAuthorizedEventStream(url: string) {
  return new AuthorizedEventStream(url, refreshSessionRequest);
}

export const api = {
  getAdminCapabilities() {
    return request<AdminCapabilitiesResponse>("/admin/capabilities");
  },

  listAdminUsers(input: { q?: string; role?: string; limit?: number; offset?: number } = {}) {
    return request<AdminUsersResponse>(`/admin/users${queryString(input)}`);
  },

  getAdminUser(userId: string) {
    return request<UserResponse>(`/admin/users/${encodeURIComponent(userId)}`);
  },

  updateAdminUserProfile(userId: string, input: import("./types").UpdateAdminUserProfileRequest) {
    return request<UserResponse>(`/admin/users/${encodeURIComponent(userId)}/profile`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  changeAdminUserRole(userId: string, input: { role: string; expected_role: string; reason: string }) {
    return request<UserResponse>(`/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  listAdminUserSessions(userId: string) {
    return request<UserSessionsResponse>(`/admin/users/${encodeURIComponent(userId)}/sessions`);
  },

  revokeAllAdminUserSessions(userId: string, reason: string) {
    return request<void>(`/admin/users/${encodeURIComponent(userId)}/sessions`, {
      method: "DELETE",
      body: JSON.stringify({ reason })
    });
  },

  revokeAdminUserSession(userId: string, sessionId: string, reason: string) {
    return request<void>(`/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      body: JSON.stringify({ reason })
    });
  },

  listAdminCompanies(input: { q?: string; limit?: number; offset?: number } = {}) {
    return request<AdminCompaniesResponse>(`/admin/companies${queryString(input)}`);
  },

  getAdminCompany(companyId: string) {
    return request<CompanyResponse>(`/admin/companies/${encodeURIComponent(companyId)}`);
  },

  updateCompanyTag(companyId: string, tag: string) {
    return request<CompanyResponse>(`/companies/${encodeURIComponent(companyId)}/tag`, {
      method: "PATCH",
      body: JSON.stringify({ tag })
    });
  },
  updateAdminCompanyTag(companyId: string, tag: string) {
    return request<CompanyResponse>(`/admin/companies/${encodeURIComponent(companyId)}/tag`, {
      method: "PATCH",
      body: JSON.stringify({ tag })
    });
  },

  getAdminSubscription(kind: "users" | "companies", id: string) {
    return request<AdminSubscriptionResponse>(`/admin/${kind}/${encodeURIComponent(id)}/subscription`);
  },

  grantAdminSubscription(kind: "users" | "companies", id: string, input: { plan_code: PlanCode; starts_at?: string; ends_at: string; reason: string }) {
    return request<AdminSubscriptionResponse>(`/admin/${kind}/${encodeURIComponent(id)}/subscription/grant`, {
      method: "POST", body: JSON.stringify(input)
    });
  },

  cancelAdminSubscription(kind: "users" | "companies", id: string, reason: string) {
    return request<AdminSubscriptionResponse>(`/admin/${kind}/${encodeURIComponent(id)}/subscription/cancel`, {
      method: "POST", body: JSON.stringify({ reason })
    });
  },
  resetAdminUsage(kind: "users" | "companies", id: string, reason: string) {
    return request<void>(`/admin/${kind}/${encodeURIComponent(id)}/usage/reset`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
  },

  getAdminCall(callId: string) {
    return request<CallResponse>(`/admin/calls/${encodeURIComponent(callId)}`);
  },

  listAdminUserCalls(userId: string, input: { limit?: number; offset?: number } = {}) {
    return request<CallsListResponse>(`/admin/users/${encodeURIComponent(userId)}/calls${queryString(input)}`);
  },
  login(input: LoginRequest) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async register(input: RegisterRequest) {
    await request<{ user: UserResponse }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });

    return api.login({
      email: input.email,
      password: input.password
    });
  },

  async logout() {
    await request<void>("/auth/logout", { method: "POST" });
  },

  async logoutAll() {
    await request<void>("/auth/logout-all", { method: "POST" });
  },

  refreshSession() {
    return refreshSessionRequest();
  },

  updateUsername(username: string) {
    return request<UserResponse>("/auth/me/username", {
      method: "PATCH",
      body: JSON.stringify({ username })
    });
  },

  updateProfile(input: UpdateProfileRequest) {
    return request<UserResponse>("/auth/me/profile", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  uploadAvatar(file: File) {
    const body = new FormData();
    body.append("avatar", file);
    return request<AvatarResponse>("/auth/me/avatar", { method: "POST", body });
  },

  deleteAvatar() {
    return request<void>("/auth/me/avatar", { method: "DELETE" });
  },

  getPreferences() {
    return request<UserPreferencesResponse>("/auth/me/preferences");
  },

  updatePreferences(input: UpdatePreferencesRequest) {
    return request<UserPreferencesResponse>("/auth/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  updatePassword(input: UpdatePasswordRequest) {
    return request<UpdatePasswordResponse>("/auth/me/password", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  listSessions() {
    return request<UserSessionsResponse>("/auth/me/sessions");
  },

  deleteSession(sessionId: string) {
    return request<void>(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  },

  lookupUserByUsername(username: string) {
    const query = new URLSearchParams({ username }).toString();
    return request<UserResponse>(`/users/lookup?${query}`);
  },

  listCalls(filters?: {
    q?: string;
    status?: CallStatus;
    scope?: VisibilityScope;
    company_uuid?: string;
    department_uuid?: string;
    uploaded_by_user_uuid?: string;
    folder_uuid?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    return request<CallResponse[] | CallsListResponse>(`/calls${queryString(filters)}`);
  },

  getCallFilterOptions(input?: {
    company_uuid?: string;
    department_uuid?: string;
  }) {
    return request<CallFilterOptionsResponse>(`/calls/filters${queryString(input)}`);
  },

  createCall(
    input: {
      title?: string;
      media: File;
      companyUuid?: string;
      departmentUuid?: string;
      useCustomInstructions?: boolean;
    }
  ) {
    const body = new FormData();
    if (input.title?.trim()) body.append("title", input.title.trim());
    body.append("media", input.media);
    if (input.companyUuid) body.append("company_uuid", input.companyUuid);
    if (input.departmentUuid) body.append("department_uuid", input.departmentUuid);
    if (typeof input.useCustomInstructions === "boolean") {
      body.append("use_custom_instructions", String(input.useCustomInstructions));
    }

    return request<CallResponse>("/calls", { method: "POST", body });
  },

  listPromptIndustries(perspective?: PromptPerspective) {
    return request<PromptIndustry[]>(`/prompt-catalog/industries${queryString({ perspective })}`);
  },

  listPromptTopics(industry_key: string, q?: string) {
    return request<PromptTopic[]>(`/prompt-catalog/topics${queryString({ industry_key, q })}`);
  },

  recommendPromptTopics(input: { perspective: PromptPerspective; description: string }) {
    return request<PromptTopic[]>("/prompt-catalog/recommendations", { method: "POST", body: JSON.stringify(input) });
  },

  listPromptProfiles() { return request<PromptProfile[]>("/prompt-profiles"); },

  getPromptSettings() { return request<PromptUserSettings>("/prompt-settings"); },
  savePromptSettings(input: { description: string; industry_keys: string[]; topic_keys: string[] }) { return request<PromptUserSettings>("/prompt-settings", { method: "PUT", body: JSON.stringify(input) }); },

  savePromptProfile(input: Omit<PromptProfile, "id"> & { id?: string }) {
    const path = input.id ? `/prompt-profiles/${encodeURIComponent(input.id)}` : "/prompt-profiles";
    return request<PromptProfile>(path, { method: input.id ? "PATCH" : "POST", body: JSON.stringify(input) });
  },

  putCallPromptContext(callId: string, input: { profile_id?: string; topic_keys: string[] }) {
    return request(`/calls/${encodeURIComponent(callId)}/prompt-context`, { method: "PUT", body: JSON.stringify(input) });
  },

  updateCallTitle(callId: string, title: string) {
    return request<CallResponse>(`/calls/${encodeURIComponent(callId)}`, {
      method: "PATCH",
      body: JSON.stringify({ title })
    });
  },

  deleteCall(callId: string) {
    return request<void>(`/calls/${encodeURIComponent(callId)}`, { method: "DELETE" });
  },

  listCallFolders(input?: {
    scope?: VisibilityScope;
    company_uuid?: string;
    department_uuid?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return request<CallFoldersListResponse>(`/call-folders${queryString(input)}`);
  },

  createCallFolder(input: CreateCallFolderRequest) {
    return request<CallFolderResponse>("/call-folders", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  getCallFolder(folderId: string) {
    return request<CallFolderResponse>(`/call-folders/${encodeURIComponent(folderId)}`);
  },

  updateCallFolder(folderId: string, input: UpdateCallFolderRequest) {
    return request<CallFolderResponse>(`/call-folders/${encodeURIComponent(folderId)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  deleteCallFolder(folderId: string) {
    return request<void>(`/call-folders/${encodeURIComponent(folderId)}`, { method: "DELETE" });
  },

  listCallFolderCalls(folderId: string, input?: { limit?: number; offset?: number }) {
    return request<CallsListResponse>(`/call-folders/${encodeURIComponent(folderId)}/calls${queryString(input)}`);
  },

  assignCallToFolder(folderId: string, callId: string) {
    return request<void>(`/call-folders/${encodeURIComponent(folderId)}/calls`, {
      method: "POST",
      body: JSON.stringify({ call_uuid: callId })
    });
  },

  removeCallFromFolder(folderId: string, callId: string) {
    return request<void>(
      `/call-folders/${encodeURIComponent(folderId)}/calls/${encodeURIComponent(callId)}`,
      { method: "DELETE" }
    );
  },

  listCompanies() {
    return request<CompanyResponse[]>("/companies");
  },

  createCompany(name: string) {
    return request<CompanyResponse>("/companies", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  getCompany(companyId: string) {
    return request<CompanyResponse>(`/companies/${encodeURIComponent(companyId)}`);
  },

  updateCompany(companyId: string, name: string) {
    return request<CompanyResponse>(`/companies/${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    });
  },

  deleteCompany(companyId: string) {
    return request<void>(`/companies/${encodeURIComponent(companyId)}`, { method: "DELETE" });
  },

  async getCompanySubscription(companyId: string) {
    const subscription = await request<RawSubscription>(`/companies/${encodeURIComponent(companyId)}/subscription`);
    return normalizeSubscription(subscription);
  },

  async getSubscription() {
    const subscription = await request<RawSubscription>("/subscription");
    return normalizeSubscription(subscription);
  },

  async getSubscriptionUsage(period?: string) {
    const usage = await request<RawSubscriptionUsageResponse>(`/subscription/usage${queryString({ period })}`);
    return normalizeSubscriptionUsage(usage);
  },

  async getCompanySubscriptionUsage(companyId: string, period?: string) {
    const usage = await request<RawSubscriptionUsageResponse>(
      `/companies/${encodeURIComponent(companyId)}/subscription/usage${queryString({ period })}`
    );
    return normalizeSubscriptionUsage(usage);
  },

  listDepartments(companyId: string) {
    return request<DepartmentResponse[]>(`/companies/${encodeURIComponent(companyId)}/departments`);
  },

  createDepartment(companyId: string, name: string) {
    return request<DepartmentResponse>(`/companies/${encodeURIComponent(companyId)}/departments`, {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  updateDepartment(companyId: string, departmentId: string, name: string) {
    return request<DepartmentResponse>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name })
      }
    );
  },

  deleteDepartment(companyId: string, departmentId: string) {
    return request<void>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}`,
      { method: "DELETE" }
    );
  },

  listCompanyMembers(companyId: string, filters?: {
    status?: "active" | "suspended" | "left";
    role?: "employee" | "company_manager" | "department_leader";
    department_uuid?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return request<CompanyMembersResponse>(
      `/companies/${encodeURIComponent(companyId)}/members${queryString(filters)}`
    );
  },

  updateCompanyMemberStatus(
    companyId: string,
    userId: string,
    status: "active" | "suspended" | "left"
  ) {
    return request<CompanyMemberListItemResponse>(
      `/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(userId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      }
    );
  },
  leaveCompany(companyId: string) {
    return request<CompanyMemberListItemResponse>(`/companies/${encodeURIComponent(companyId)}/leave`, { method: "POST" });
  },

  listDepartmentMembers(companyId: string, departmentId: string) {
    return request<DepartmentMemberResponse[]>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/members`
    );
  },

  updateDepartmentMemberRole(
    companyId: string,
    departmentId: string,
    userId: string,
    role: InvitationDepartmentRole
  ) {
    return request<DepartmentMemberResponse>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/members/${encodeURIComponent(userId)}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role })
      }
    );
  },

  updateDepartmentMemberStatus(
    companyId: string,
    departmentId: string,
    userId: string,
    status: "active" | "suspended" | "left"
  ) {
    return request<DepartmentMemberResponse>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/members/${encodeURIComponent(userId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      }
    );
  },

  createCompanyInvitation(companyId: string, username: string) {
    return request<Invitation>(`/companies/${encodeURIComponent(companyId)}/invitations`, {
      method: "POST",
      body: JSON.stringify({ username, role: "employee" })
    });
  },

  createDepartmentInvitation(
    companyId: string,
    departmentId: string,
    username: string,
    role: InvitationDepartmentRole
  ) {
    return request<Invitation>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ username, role })
      }
    );
  },

  listMyInvitations(status?: InvitationStatus) {
    const query = status ? `?${new URLSearchParams({ status }).toString()}` : "";
    return request<Invitation[]>(`/invitations${query}`);
  },

  acceptInvitation(invitationId: string) {
    return request<Invitation>(`/invitations/${encodeURIComponent(invitationId)}/accept`, {
      method: "POST"
    });
  },

  declineInvitation(invitationId: string) {
    return request<Invitation>(`/invitations/${encodeURIComponent(invitationId)}/decline`, {
      method: "POST"
    });
  },

  cancelCompanyInvitation(companyId: string, invitationId: string) {
    return request<Invitation>(
      `/companies/${encodeURIComponent(companyId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
      { method: "POST" }
    );
  },

  cancelDepartmentInvitation(companyId: string, departmentId: string, invitationId: string) {
    return request<Invitation>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
      { method: "POST" }
    );
  },

  getTranscription(callId: string) {
    return request<TranscriptionResponse>(`/calls/${callId}/transcription`);
  },

  getAnalysis(callId: string) {
    return request<AnalysisResponse>(`/calls/${callId}/analysis`);
  },

  analyzeCall(callId: string) {
    return request<AnalysisResponse>(`/calls/${callId}/analysis`, { method: "POST" });
  },

  createReport(callId: string, input: CreateReportRequest) {
    return request<ReportResponse>(`/calls/${encodeURIComponent(callId)}/reports`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  listGlobalReports(filters?: {
    format?: ReportFormat;
    status?: ReportStatus;
    company_uuid?: string;
    department_uuid?: string;
    call_uuid?: string;
    from?: string;
    to?: string;
    sort?: "created_at" | "updated_at";
    order?: "desc" | "asc";
    limit?: number;
    offset?: number;
  }) {
    return request<GlobalReportsResponse>(`/reports${queryString(filters)}`);
  },

  createGlobalReport(input: CreateGlobalReportRequest) {
    return request<ReportResponse>("/reports", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  listReports(callId: string) {
    return request<ReportsResponse>(`/calls/${encodeURIComponent(callId)}/reports`);
  },

  downloadReport(report: ReportResponse) {
    const path = report.download_url ?? `/reports/${encodeURIComponent(report.id)}/download`;
    return requestBlob(path.startsWith("/api/v1/") ? path.slice("/api/v1".length) : path);
  },

  deleteReport(reportId: string) {
    return request<void>(`/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" });
  },

  getAnalyticsOverview(filters?: {
    from?: string;
    to?: string;
    scope?: VisibilityScope;
    company_uuid?: string;
    department_uuid?: string;
    folder_uuid?: string;
  }) {
    return request<AnalyticsOverviewResponse>(`/analytics/overview${queryString(filters)}`);
  },

  createDeepAnalysis(input: CreateDeepAnalysisRequest) {
    return request<AggregateAnalysisResponse>("/analytics/deep-analyses", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  listDeepAnalyses(input?: ListDeepAnalysesQuery) {
    return request<ListAggregateAnalysesResponse>(`/analytics/deep-analyses${queryString(input)}`);
  },

  getDeepAnalysis(id: string) {
    return request<AggregateAnalysisResponse>(`/analytics/deep-analyses/${encodeURIComponent(id)}`);
  },

  getDeepAnalysisEventsUrl(analysisId: string) {
    return `${apiRoot}/analytics/deep-analyses/${encodeURIComponent(analysisId)}/events`;
  },

  createAggregateReport(analysisId: string, format: ReportFormat) {
    const input: CreateAggregateReportRequest = { format };
    return request<AggregateReportResponse>(
      `/analytics/deep-analyses/${encodeURIComponent(analysisId)}/reports`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
  },

  listAggregateReports(analysisId: string) {
    return request<ListAggregateReportsResponse>(
      `/analytics/deep-analyses/${encodeURIComponent(analysisId)}/reports`
    );
  },

  downloadAggregateReport(report: AggregateReportResponse) {
    if (report.status !== "ready") {
      throw new ApiError(409, "Отчет глубокого анализа еще формируется", "report_not_ready");
    }

    if (report.download_url) {
      const downloadUrl = report.download_url;
      if (/^https?:\/\//i.test(downloadUrl) || downloadUrl.startsWith("/")) {
        return requestAssetBlob(absoluteApiAssetUrl(downloadUrl));
      }

      return requestBlob(apiPathFromUrl(downloadUrl));
    }

    return requestBlob(`/analytics/deep-analysis-reports/${encodeURIComponent(report.id)}/download`);
  },

  deleteAggregateReport(reportId: string) {
    return request<void>(
      `/analytics/deep-analysis-reports/${encodeURIComponent(reportId)}`,
      { method: "DELETE" }
    );
  },

  getProcessingMonitoring(filters?: {
    company_uuid?: string;
    from?: string;
    to?: string;
  }) {
    return request<ProcessingMonitoringResponse>(`/monitoring/processing${queryString(filters)}`);
  },

  search(input: {
    q: string;
    types?: ("calls" | "companies" | "reports" | "instructions")[];
    limit?: number;
  }) {
    return request<SearchResponse>(`/search${queryString(input)}`);
  },

  listNotifications(input?: {
    unread_only?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return request<NotificationsResponse>(`/notifications${queryString(input)}`);
  },

  markNotificationRead(notificationId: string) {
    return request<void>(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" });
  },

  markAllNotificationsRead() {
    return request<void>("/notifications/read-all", { method: "POST" });
  },

  callEventsUrl(callId: string) {
    return `${apiRoot}/calls/${encodeURIComponent(callId)}/events`;
  },

  listInstructions(
    inputOrScope: InstructionScope | {
      scope: InstructionScope;
      company_uuid?: string;
      department_uuid?: string;
      include_inactive?: boolean;
      q?: string;
      limit?: number;
      offset?: number;
    },
    companyUuid?: string,
    departmentUuid?: string
  ) {
    const input =
      typeof inputOrScope === "string"
        ? { scope: inputOrScope, company_uuid: companyUuid, department_uuid: departmentUuid }
        : inputOrScope;
    return request<AnalysisInstruction[]>(`/instructions${queryString(input)}`);
  },

  getInstruction(id: string) {
    return request<AnalysisInstruction>(`/instructions/${encodeURIComponent(id)}`);
  },

  updateInstruction(id: string, input: {
    title?: string;
    is_active?: boolean;
    sort_order?: number;
  }) {
    return request<AnalysisInstruction>(`/instructions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  replaceInstructionFile(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<AnalysisInstruction>(`/instructions/${encodeURIComponent(id)}/file`, {
      method: "PUT",
      body
    });
  },

  downloadInstruction(idOrDownloadUrl: string) {
    const path = idOrDownloadUrl.startsWith("/") || idOrDownloadUrl.startsWith("/api/v1/")
      ? apiPathFromUrl(idOrDownloadUrl)
      : `/instructions/${encodeURIComponent(idOrDownloadUrl)}/download`;
    return requestBlob(path);
  },

  reorderInstructions(input: {
    scope: InstructionScope;
    company_uuid?: string;
    department_uuid?: string;
    items: { id: string; sort_order: number }[];
  }) {
    return request<AnalysisInstruction[] | void>("/instructions/reorder", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  deleteInstruction(id: string) {
    return request<void>(`/instructions/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async listPlans() {
    const response = await request<{ plans?: RawPlan[] }>("/plans");
    return {
      plans: Array.isArray(response.plans) ? response.plans.map(normalizePlan) : []
    } satisfies PlansResponse;
  },

  activateCompanySubscription(companyId: string, planCode?: PlanCode) {
    const body = planCode ? { plan_code: planCode } : {};
    return request<Subscription>(`/companies/${encodeURIComponent(companyId)}/subscription/activate`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },

  activateSubscription(planCode?: PlanCode) {
    const body = planCode ? { plan_code: planCode } : {};
    return request<Subscription>("/subscription/activate", {
      method: "POST",
      body: JSON.stringify(body)
    });
  },

  cancelCompanySubscription(companyId: string) {
    return request<Subscription>(`/companies/${encodeURIComponent(companyId)}/subscription/cancel`, {
      method: "POST"
    });
  },

  createInstruction(
    input: {
      title: string;
      file: File;
      scope: InstructionScope;
      companyUuid?: string;
      departmentUuid?: string;
    }
  ) {
    const body = new FormData();
    body.append("title", input.title);
    body.append("file", input.file);
    body.append("scope", input.scope);
    if (input.companyUuid) body.append("company_uuid", input.companyUuid);
    if (input.departmentUuid) body.append("department_uuid", input.departmentUuid);
    return request<AnalysisInstruction>("/instructions", { method: "POST", body });
  }
};
