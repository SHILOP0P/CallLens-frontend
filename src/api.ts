import type {
  AnalysisInstruction,
  AnalysisResponse,
  AuthResponse,
  CallResponse,
  CompanyResponse,
  DepartmentResponse,
  Invitation,
  InvitationDepartmentRole,
  InvitationStatus,
  InstructionScope,
  LoginRequest,
  Plan,
  PlanCode,
  PlanType,
  PlansResponse,
  RegisterRequest,
  Subscription,
  TranscriptionResponse,
  UserResponse
} from "./types";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const apiRoot = `${configuredBase}/api/v1`;
const authRefreshPath = "/auth/refresh";
let refreshSessionPromise: Promise<AuthResponse> | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
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
  company_not_found: "Компания не найдена",
  department_not_found: "Отдел не найден",
  user_not_found: "Пользователь не найден",
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
  export_access_denied: "Экспорт недоступен на текущем тарифе",
  team_analytics_access_denied: "Командная аналитика недоступна на текущем тарифе",
  api_access_denied: "API-доступ недоступен на текущем тарифе"
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

function isRecord(value: unknown): value is ApiPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getApiErrorCode(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return typeof payload.error.code === "string" ? payload.error.code : undefined;
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

function refreshSessionRequest() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = request<AuthResponse>(
      authRefreshPath,
      { method: "POST" },
      { retryOnUnauthorized: false }
    ).finally(() => {
      refreshSessionPromise = null;
    });
  }

  return refreshSessionPromise;
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

    const code = getApiErrorCode(payload);
    const message = getApiErrorMessage(payload, response.status, path, init);

    throw new ApiError(response.status, message, code);
  }

  return payload as T;
}

export const api = {
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

  logout() {
    return request<void>("/auth/logout", { method: "POST" });
  },

  refreshSession() {
    return refreshSessionRequest();
  },

  listCalls() {
    return request<CallResponse[]>("/calls");
  },

  createCall(
    input: {
      title: string;
      audio: File;
      companyUuid?: string;
      departmentUuid?: string;
    }
  ) {
    const body = new FormData();
    body.append("title", input.title);
    body.append("audio", input.audio);
    if (input.companyUuid) body.append("company_uuid", input.companyUuid);
    if (input.departmentUuid) body.append("department_uuid", input.departmentUuid);

    return request<CallResponse>("/calls", { method: "POST", body });
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

  getCompanySubscription(companyId: string) {
    return request<Subscription>(`/companies/${encodeURIComponent(companyId)}/subscription`);
  },

  getSubscription() {
    return request<Subscription>("/subscription");
  },

  listDepartments(companyId: string) {
    return request<DepartmentResponse[]>(`/companies/${companyId}/departments`);
  },

  createCompanyInvitation(companyId: string, userUuid: string) {
    return request<Invitation>(`/companies/${encodeURIComponent(companyId)}/invitations`, {
      method: "POST",
      body: JSON.stringify({ user_uuid: userUuid, role: "employee" })
    });
  },

  createDepartmentInvitation(
    companyId: string,
    departmentId: string,
    userUuid: string,
    role: InvitationDepartmentRole
  ) {
    return request<Invitation>(
      `/companies/${encodeURIComponent(companyId)}/departments/${encodeURIComponent(departmentId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ user_uuid: userUuid, role })
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

  callEventsUrl(callId: string) {
    return `${apiRoot}/calls/${encodeURIComponent(callId)}/events`;
  },

  listInstructions(
    scope: InstructionScope,
    companyUuid?: string,
    departmentUuid?: string
  ) {
    const params = new URLSearchParams({ scope });
    if (companyUuid) params.set("company_uuid", companyUuid);
    if (departmentUuid) params.set("department_uuid", departmentUuid);
    return request<AnalysisInstruction[]>(`/instructions?${params.toString()}`);
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
