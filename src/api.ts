import type {
  AnalysisInstruction,
  AnalysisResponse,
  AuthResponse,
  CallResponse,
  CompanyResponse,
  DepartmentResponse,
  InstructionScope,
  LoginRequest,
  RegisterRequest,
  TranscriptionResponse,
  UserResponse
} from "./types";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const apiRoot = `${configuredBase}/api/v1`;
const authRefreshPath = "/auth/refresh";

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
        await request<AuthResponse>(authRefreshPath, { method: "POST" }, { retryOnUnauthorized: false });
        return request<T>(path, init, { retryOnUnauthorized: false });
      } catch {
        // Keep the original unauthorized error for the caller.
      }
    }

    const code = typeof payload === "object" && payload?.error?.code ? payload.error.code : undefined;
    const message =
      typeof payload === "object" && payload?.error?.message
        ? payload.error.message
        : `HTTP ${response.status}`;

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
