import type {
  AnalysisInstruction,
  AnalysisResponse,
  AuthResponse,
  CallResponse,
  CompanyResponse,
  DepartmentResponse,
  InstructionScope,
  LoginRequest,
  Plan,
  PlanCode,
  PlanType,
  PlansResponse,
  RegisterRequest,
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
  plan_limit_exceeded: "Лимит тарифа исчерпан",
  monthly_minutes_limit_exceeded: "Месячный лимит минут исчерпан",
  instruction_limit_exceeded: "Лимит активных инструкций исчерпан",
  company_limit_exceeded: "Лимит компаний исчерпан",
  department_limit_exceeded: "Лимит отделов исчерпан",
  member_limit_exceeded: "Лимит сотрудников исчерпан",
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
  if (code === "subscription_required" && init.method === "POST" && path === "/companies") {
    return "Для создания компании нужна бизнес-подписка";
  }

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
    analysis_level: typeof plan.analysis_level === "string" ? plan.analysis_level : "",
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

  listDepartments(companyId: string) {
    return request<DepartmentResponse[]>(`/companies/${companyId}/departments`);
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
