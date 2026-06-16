import {
  Bell,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  CloudUpload,
  Download,
  FileAudio,
  FileDown,
  FileText,
  Headphones,
  LockKeyhole,
  LogOut,
  Mic2,
  Moon,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  WandSparkles,
  X
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { api, ApiError } from "./api";
import type {
  AnalysisInstruction,
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CallStatusEvent,
  CompanyResponse,
  DepartmentResponse,
  Invitation,
  InvitationDepartmentRole,
  InstructionScope,
  Plan,
  PlanCode,
  ReportFormat,
  ReportResponse,
  SessionState,
  Subscription,
  TranscriptionResponse,
  VisibilityScope
} from "./types";

const SESSION_KEY = "calllens.session.v1";
const THEME_KEY = "calllens.theme.v1";

type AppTheme = "light" | "dark";
type ThemePreference = AppTheme | "system";
type ThemeToggleEvent = React.MouseEvent<HTMLButtonElement>;
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function getSystemTheme(): AppTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readThemePreference(): ThemePreference {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

const pageRoutes: Record<AppPage, string> = {
  overview: "/app/overview",
  calls: "/app/calls",
  upload: "/app/upload",
  analysis: "/app/analysis",
  instructions: "/app/instructions",
  invitations: "/app/invitations",
  companies: "/app/companies",
  profile: "/app/profile",
  tariffs: "/app/tariffs"
};

const navItems: Array<{ page: AppPage; label: string }> = [
  { page: "overview", label: "Обзор" },
  { page: "calls", label: "Звонки" },
  { page: "analysis", label: "AI-анализ" },
  { page: "tariffs", label: "Тарифы" }
];

const sidebarItems: Array<{ page: AppPage; label: string; icon: React.ReactNode }> = [
  { page: "upload", label: "Загрузка", icon: <CloudUpload size={18} /> },
  { page: "companies", label: "Компании", icon: <Building2 size={18} /> },
  { page: "instructions", label: "Инструкции", icon: <FileText size={18} /> },
  { page: "invitations", label: "Приглашения", icon: <Bell size={18} /> },
  { page: "profile", label: "Профиль", icon: <CircleUserRound size={18} /> }
];

function readStoredSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as SessionState & { demo?: boolean };
    if (stored.demo) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return stored;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function pageFromPath(pathname: string): AppPage {
  const entry = Object.entries(pageRoutes).find(([, route]) => route === pathname);
  return (entry?.[0] as AppPage | undefined) ?? "calls";
}

function persistSession(session: SessionState | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function useRevealOnScroll<T extends HTMLElement>() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.16
      }
    );

    const observed = new WeakSet<Element>();
    const observeTargets = () => {
      document.querySelectorAll<T>("[data-reveal], [data-reveal-item]").forEach((target) => {
        if (observed.has(target) || target.classList.contains("is-visible")) return;
        observed.add(target);
        observer.observe(target);
      });
    };

    observeTargets();

    const mutationObserver = new MutationObserver(observeTargets);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, []);
}

const statusMeta: Record<
  CallStatus,
  {
    label: string;
    chip: string;
    description: string;
  }
> = {
  new: { label: "Новый", chip: "Новый", description: "Файл загружен и принят" },
  processing: { label: "В обработке", chip: "В обработке", description: "Идет обработка аудио" },
  transcribed: { label: "Расшифрован", chip: "Расшифрован", description: "Текстовая расшифровка готова" },
  analyzed: { label: "Проанализирован", chip: "Анализ готов", description: "AI-анализ завершен" },
  failed: { label: "Ошибка", chip: "Ошибка", description: "Нужно проверить файл" }
};

const normalTimelineSteps: CallStatus[] = ["new", "processing", "transcribed", "analyzed"];

type AnalysisQuestion = {
  question?: string;
  managerAnswer?: string;
  answerStatus?: string;
  evidenceQuotes: string[];
};

type AnalysisDetails = {
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

const answerStatusLabels: Record<string, string> = {
  answered: "Ответ дан",
  partially_answered: "Частично отвечено",
  not_answered: "Нет ответа",
  unclear: "Неясно"
};

const coverageStatusLabels: Record<string, string> = {
  answered: "Все вопросы закрыты",
  partially_answered: "Часть вопросов закрыта",
  not_answered: "Вопросы не закрыты",
  no_questions: "Вопросов не было",
  unclear: "Неясно"
};

const confidenceLabels: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая"
};

const planOrder: PlanCode[] = [
  "personal_start",
  "personal_plus",
  "personal_pro",
  "business_start",
  "business_plus",
  "business_pro"
];

const analysisLevelLabels: Record<string, string> = {
  basic: "Базовый",
  plus: "Plus",
  pro: "Pro",
  priority: "Приоритетный"
};

const planGradients: Record<PlanCode, string> = {
  personal_start: "linear-gradient(145deg, rgba(96, 165, 250, 0.42), rgba(250, 204, 21, 0.24))",
  personal_plus: "linear-gradient(145deg, rgba(45, 212, 191, 0.38), rgba(255, 122, 89, 0.28))",
  personal_pro: "linear-gradient(145deg, rgba(129, 140, 248, 0.4), rgba(236, 72, 153, 0.28))",
  business_start: "linear-gradient(145deg, rgba(52, 211, 153, 0.38), rgba(14, 165, 233, 0.26))",
  business_plus: "linear-gradient(145deg, rgba(251, 146, 60, 0.36), rgba(168, 85, 247, 0.28))",
  business_pro: "linear-gradient(145deg, rgba(244, 63, 94, 0.34), rgba(59, 130, 246, 0.3))"
};

function isCallStatus(value: unknown): value is CallStatus {
  return typeof value === "string" && value in statusMeta;
}

function timelineFromStatus(status: CallStatus) {
  if (status === "failed") return [status];

  const currentIndex = normalTimelineSteps.indexOf(status);
  if (currentIndex === -1) return ["new"] as CallStatus[];

  return normalTimelineSteps.slice(0, currentIndex + 1);
}

function nextTimelineStatuses(previous: CallStatus[], status: CallStatus) {
  if (status === "failed") {
    const completedSteps = previous.filter((step) => step !== "failed" && step !== "analyzed");
    return [...completedSteps, "failed"] as CallStatus[];
  }

  return timelineFromStatus(status);
}

function parseCallStatusEvent(event: Event): CallStatusEvent | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;

  try {
    const payload = JSON.parse(event.data) as Partial<CallStatusEvent>;
    if (
      typeof payload.call_id !== "string" ||
      !isCallStatus(payload.status) ||
      typeof payload.terminal !== "boolean" ||
      typeof payload.timestamp !== "string"
    ) {
      return null;
    }

    return {
      call_id: payload.call_id,
      status: payload.status,
      terminal: payload.terminal,
      timestamp: payload.timestamp
    };
  } catch {
    return null;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";

  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 || unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function reportFormatLabel(format: ReportFormat) {
  if (format === "pdf") return "PDF";
  if (format === "docx") return "DOCX";
  if (format === "md") return "Markdown";
  return "Excel";
}

function reportStatusLabel(status: ReportResponse["status"]) {
  if (status === "ready") return "Готов";
  if (status === "failed") return "Ошибка";
  return "Формируется";
}

function contextLabel(
  call: CallResponse,
  companies: CompanyResponse[],
  departments: DepartmentResponse[]
) {
  if (call.visibility_scope === "personal") return "Личный звонок";
  const company = companies.find((item) => item.id === call.company_uuid)?.name ?? "Компания";
  if (call.visibility_scope === "company") return company;
  const department = departments.find((item) => item.id === call.department_uuid)?.name ?? "Отдел";
  return `${company} · ${department}`;
}

function instructionScopeLabel(scope: InstructionScope) {
  if (scope === "personal") return "Лично";
  if (scope === "company") return "Компания";
  return "Отдел";
}

function callScopeLabel(scope: VisibilityScope) {
  if (scope === "personal") return "Лично мне";
  if (scope === "company") return "В компанию";
  return "В отдел";
}

function isAnalysisDone(analysis?: AnalysisResponse) {
  return analysis?.status === "done";
}

function App() {
  const [initialAuth] = useState(() => {
    const storedSession = readStoredSession();
    return {
      session: storedSession,
      ready: Boolean(storedSession)
    };
  });
  const [session, setSession] = useState<SessionState | null>(initialAuth.session);
  const [authReady, setAuthReady] = useState(initialAuth.ready);
  const [showPublicLanding, setShowPublicLanding] = useState(() => !initialAuth.session);
  const [workspaceReady, setWorkspaceReady] = useState(initialAuth.ready);
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname));
  const [calls, setCalls] = useState<CallResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [instructions, setInstructions] = useState<AnalysisInstruction[]>([]);
  const [transcriptions, setTranscriptions] = useState<Record<string, TranscriptionResponse>>({});
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResponse>>({});
  const [callTimelines, setCallTimelines] = useState<Record<string, CallStatus[]>>({});
  const [selectedCallId, setSelectedCallId] = useState<string>("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(() => Boolean(session));
  const [loadingCallDetails, setLoadingCallDetails] = useState<Record<string, boolean>>({});
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readThemePreference());
  const [systemTheme, setSystemTheme] = useState<AppTheme>(() => getSystemTheme());
  const activeTheme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");

    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.style.colorScheme = activeTheme;
  }, [activeTheme]);

  useEffect(() => {
    if (authReady || session) return;

    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await api.refreshSession();
        if (cancelled) return;

        const restoredSession = { user: response.user };
        persistSession(restoredSession);
        setSession(restoredSession);
        setShowPublicLanding(false);
        setWorkspaceReady(true);
        setLoadingWorkspace(true);

        if (!window.location.pathname.startsWith("/app")) {
          window.history.replaceState({}, "", pageRoutes.overview);
          setPage("overview");
        }
      } catch {
        if (cancelled) return;
        persistSession(null);
        clearWorkspaceState();
        setShowPublicLanding(true);
        setWorkspaceReady(true);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [authReady, session]);

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!session) return;

    if (!showPublicLanding && !window.location.pathname.startsWith("/app")) {
      window.history.replaceState({}, "", pageRoutes.calls);
      setPage("calls");
    }
  }, [session, showPublicLanding]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!authReady) return;

      if (!session) {
        clearWorkspaceState();
        setWorkspaceReady(true);
        setLoadingWorkspace(false);
        return;
      }

      setWorkspaceReady(true);
      setLoadingWorkspace(true);

      try {
        const [loadedCalls, loadedCompanies, loadedInvitations] = await Promise.all([
          api.listCalls(),
          api.listCompanies(),
          api.listMyInvitations().catch(() => [])
        ]);

        if (cancelled) return;

        const loadedDepartments = (
          await Promise.all(
            loadedCompanies.map((company) =>
              api.listDepartments(company.id).catch(() => [])
            )
          )
        ).flat();

        const loadedInstructions = (
          await Promise.all([
            api.listInstructions("personal").catch(() => []),
            ...loadedCompanies.map((company) =>
              api.listInstructions("company", company.id).catch(() => [])
            ),
            ...loadedDepartments.map((department) =>
              api
                .listInstructions("department", department.company_uuid, department.id)
                .catch(() => [])
            )
          ])
        ).flat();

        if (cancelled) return;

        setCalls(loadedCalls);
        setCallTimelines(
          loadedCalls.reduce<Record<string, CallStatus[]>>((timelines, call) => {
            timelines[call.id] = timelineFromStatus(call.status);
            return timelines;
          }, {})
        );
        setCompanies(loadedCompanies);
        setDepartments(loadedDepartments);
        setInvitations(loadedInvitations);
        setInstructions(loadedInstructions);
        setSelectedCallId((current) => current || loadedCalls[0]?.id || "");
        setWorkspaceReady(true);
      } catch (error) {
        if (cancelled) return;
        returnToLanding();
      } finally {
        if (!cancelled) setLoadingWorkspace(false);
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authReady, session]);

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) ?? calls[0],
    [calls, selectedCallId]
  );
  const selectedCallDetailsLoading = selectedCall ? Boolean(loadingCallDetails[selectedCall.id]) : false;
  const selectedCallTimeline = selectedCall ? callTimelines[selectedCall.id] : undefined;

  useEffect(() => {
    if (!session || !selectedCall) return;

    let cancelled = false;
    const callId = selectedCall.id;

    setLoadingCallDetails((current) => ({
      ...current,
      [callId]: true
    }));

    Promise.allSettled([
      api.getTranscription(callId),
      api.getAnalysis(callId)
    ])
      .then(([transcriptionResult, analysisResult]) => {
        if (cancelled) return;

        if (transcriptionResult.status === "fulfilled") {
          setTranscriptions((current) => ({
            ...current,
            [callId]: transcriptionResult.value
          }));
        }

        if (analysisResult.status === "fulfilled") {
          setAnalyses((current) => ({
            ...current,
            [callId]: analysisResult.value
          }));
        }
      })
      .finally(() => {
        if (cancelled) return;

        setLoadingCallDetails((current) => ({
          ...current,
          [callId]: false
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCall?.id, selectedCall?.status, session]);

  useEffect(() => {
    if (!session || !selectedCall) return;

    const callId = selectedCall.id;
    const source = new EventSource(api.callEventsUrl(callId), { withCredentials: true });
    let closed = false;

    function closeStream() {
      if (closed) return;
      closed = true;
      source.close();
    }

    source.addEventListener("status", (event) => {
      const statusEvent = parseCallStatusEvent(event);
      if (!statusEvent || statusEvent.call_id !== callId) return;

      setCalls((current) =>
        current.map((call) =>
          call.id === callId && call.status !== statusEvent.status
            ? { ...call, status: statusEvent.status }
            : call
        )
      );
      setCallTimelines((current) => ({
        ...current,
        [callId]: nextTimelineStatuses(
          current[callId] ?? timelineFromStatus(statusEvent.status),
          statusEvent.status
        )
      }));

      if (statusEvent.terminal) closeStream();
    });

    source.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        closeStream();
      }
    });

    return closeStream;
  }, [session, selectedCall?.id]);

  function navigate(nextPage: AppPage) {
    setShowPublicLanding(false);
    setPage(nextPage);
    window.history.pushState({}, "", pageRoutes[nextPage]);
  }

  function applySession(nextSession: SessionState) {
    persistSession(nextSession);
    setSession(nextSession);
    setWorkspaceReady(true);
    setLoadingWorkspace(true);
    navigate("overview");
  }

  async function logout() {
    if (session) {
      await api.logout().catch(() => undefined);
    }
    persistSession(null);
    setSession(null);
    clearWorkspaceState();
    setWorkspaceReady(true);
    setShowPublicLanding(true);
    window.history.pushState({}, "", "/");
    setPage("calls");
  }

  function toggleTheme(event: ThemeToggleEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const maxX = Math.max(originX, window.innerWidth - originX);
    const maxY = Math.max(originY, window.innerHeight - originY);
    const radius = Math.hypot(maxX, maxY);
    const root = document.documentElement;
    const transitionDocument = document as ViewTransitionDocument;

    root.style.setProperty("--theme-reveal-x", `${originX}px`);
    root.style.setProperty("--theme-reveal-y", `${originY}px`);
    root.style.setProperty("--theme-reveal-radius", `${radius}px`);

    const applyTheme = () => {
      flushSync(() => {
        setThemePreference((current) => {
          const currentTheme = current === "system" ? systemTheme : current;
          const nextTheme: AppTheme = currentTheme === "dark" ? "light" : "dark";
          localStorage.setItem(THEME_KEY, nextTheme);
          return nextTheme;
        });
      });
    };

    if (!transitionDocument.startViewTransition) {
      applyTheme();
      return;
    }

    root.classList.add("theme-reveal-running");
    const transition = transitionDocument.startViewTransition(applyTheme);
    transition.finished.finally(() => {
      root.classList.remove("theme-reveal-running");
      root.style.removeProperty("--theme-reveal-x");
      root.style.removeProperty("--theme-reveal-y");
      root.style.removeProperty("--theme-reveal-radius");
    });
  }

  function openLanding() {
    setShowPublicLanding(true);
    window.history.pushState({}, "", "/");
  }

  function getStarted() {
    if (session) {
      navigate("overview");
      return;
    }

    setShowPublicLanding(true);
  }

  function clearWorkspaceState() {
    setCalls([]);
    setCompanies([]);
    setDepartments([]);
    setInvitations([]);
    setInstructions([]);
    setTranscriptions({});
    setAnalyses({});
    setCallTimelines({});
    setLoadingCallDetails({});
    setSelectedCallId("");
  }

  function returnToLanding() {
    persistSession(null);
    setSession(null);
    clearWorkspaceState();
    setWorkspaceReady(true);
    setShowPublicLanding(true);
    window.history.replaceState({}, "", "/");
    setPage("calls");
  }

  async function refreshOrganizationContext() {
    const loadedCompanies = await api.listCompanies();
    const loadedDepartments = (
      await Promise.all(
        loadedCompanies.map((company) =>
          api.listDepartments(company.id).catch(() => [])
        )
      )
    ).flat();
    const loadedInstructions = (
      await Promise.all([
        api.listInstructions("personal").catch(() => []),
        ...loadedCompanies.map((company) =>
          api.listInstructions("company", company.id).catch(() => [])
        ),
        ...loadedDepartments.map((department) =>
          api
            .listInstructions("department", department.company_uuid, department.id)
            .catch(() => [])
        )
      ])
    ).flat();

    setCompanies(loadedCompanies);
    setDepartments(loadedDepartments);
    setInstructions(loadedInstructions);
  }

  async function deleteCall(callId: string) {
    await api.deleteCall(callId);

    setCalls((current) => {
      const nextCalls = current.filter((call) => call.id !== callId);
      setSelectedCallId((selectedId) =>
        selectedId === callId ? nextCalls[0]?.id ?? "" : selectedId
      );
      return nextCalls;
    });
    setTranscriptions((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
    setAnalyses((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
    setCallTimelines((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
    setLoadingCallDetails((current) => {
      const { [callId]: _removed, ...rest } = current;
      return rest;
    });
  }

  if (!authReady) {
    return (
      <main className="landing preflight-screen" aria-label="Проверка сессии">
        <div className="landing-bg" />
      </main>
    );
  }

  if (!session || showPublicLanding) {
    return (
      <Landing
        session={session}
        theme={activeTheme}
        onAuth={applySession}
        onGetStarted={getStarted}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (!workspaceReady) {
    return (
      <main className="landing preflight-screen" aria-label="Проверка сессии">
        <div className="landing-bg" />
      </main>
    );
  }

  return (
    <AuthenticatedShell
      activePage={page}
      session={session}
      theme={activeTheme}
      invitationCount={invitations.filter((invitation) => invitation.status === "pending").length}
      companyCount={companies.length}
      onNavigate={navigate}
      onOpenLanding={openLanding}
      onToggleTheme={toggleTheme}
      onLogout={logout}
    >
      {page === "overview" && (
        <OverviewPage
          calls={calls}
          companies={companies}
          departments={departments}
          loading={loadingWorkspace}
          loadingDetails={selectedCallDetailsLoading}
          selectedCall={selectedCall}
          selectedCallTimeline={selectedCallTimeline}
          transcription={selectedCall ? transcriptions[selectedCall.id] : undefined}
          analysis={selectedCall ? analyses[selectedCall.id] : undefined}
          onNavigate={navigate}
        />
      )}

      {page === "calls" && (
        <CallsPage
          calls={calls}
          companies={companies}
          departments={departments}
          selectedCall={selectedCall}
          selectedCallId={selectedCallId}
          selectedCallTimeline={selectedCallTimeline}
          transcription={selectedCall ? transcriptions[selectedCall.id] : undefined}
          analysis={selectedCall ? analyses[selectedCall.id] : undefined}
          onSelectCall={setSelectedCallId}
          onNavigate={navigate}
          onDeleteCall={deleteCall}
          loading={loadingWorkspace}
          loadingDetails={selectedCallDetailsLoading}
        />
      )}

      {page === "upload" && (
        <UploadPage
          session={session}
          companies={companies}
          departments={departments}
          instructions={instructions}
          loading={loadingWorkspace}
          onNavigate={navigate}
          onUploaded={(call) => {
            setCalls((current) => [call, ...current]);
            setCallTimelines((current) => ({
              ...current,
              [call.id]: timelineFromStatus(call.status)
            }));
            setSelectedCallId(call.id);
            navigate("calls");
          }}
        />
      )}

      {page === "analysis" && (
        <AnalysisPage
          session={session}
          calls={calls}
          selectedCall={selectedCall}
          selectedCallId={selectedCallId}
          selectedCallTimeline={selectedCallTimeline}
          analyses={analyses}
          instructions={instructions}
          companies={companies}
          departments={departments}
          loading={loadingWorkspace}
          loadingDetails={selectedCallDetailsLoading}
          onSelectCall={setSelectedCallId}
          onAnalysisReady={(callId, analysis) =>
            setAnalyses((current) => ({
              ...current,
              [callId]: analysis
            }))
          }
          onDeleteCall={deleteCall}
          onNavigate={navigate}
        />
      )}

      {page === "instructions" && (
        <InstructionsPage
          session={session}
          instructions={instructions}
          companies={companies}
          departments={departments}
          loading={loadingWorkspace}
          onInstructionCreated={(instruction) =>
            setInstructions((current) => [instruction, ...current])
          }
        />
      )}

      {page === "invitations" && (
        <InvitationsPage
          invitations={invitations}
          companies={companies}
          departments={departments}
          session={session}
          loading={loadingWorkspace}
          onInvitationCreated={(invitation) =>
            setInvitations((current) =>
              invitation.invited_user_uuid === session.user.id ? [invitation, ...current] : current
            )
          }
          onInvitationAccepted={async (invitation) => {
            setInvitations((current) => current.filter((item) => item.id !== invitation.id));
            await refreshOrganizationContext().catch(() => undefined);
          }}
          onInvitationDeclined={(invitation) =>
            setInvitations((current) => current.filter((item) => item.id !== invitation.id))
          }
        />
      )}

      {page === "companies" && (
        <CompaniesPage
          session={session}
          companies={companies}
          departments={departments}
          onCompanyCreated={async (company) => {
            setCompanies((current) => [company, ...current]);
            await refreshOrganizationContext().catch(() => undefined);
          }}
          onNavigate={navigate}
        />
      )}

      {page === "profile" && (
        <ProfilePage
          session={session}
          companies={companies}
          onCompanyCreated={async (company) => {
            setCompanies((current) => [company, ...current]);
            await refreshOrganizationContext().catch(() => undefined);
          }}
          onNavigate={navigate}
        />
      )}

      {page === "tariffs" && <TariffsPage session={session} companies={companies} />}
    </AuthenticatedShell>
  );
}

function Logo({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <span className="logo-mark">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>CallLens</span>
    </>
  );

  if (onClick) {
    return (
      <button className="logo logo-button" type="button" onClick={onClick} aria-label="CallLens">
        {content}
      </button>
    );
  }

  return (
    <div className="logo" aria-label="CallLens">
      {content}
    </div>
  );
}

function SelectControl(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-control">
      <select {...props} />
    </span>
  );
}

function Landing({
  session,
  theme,
  onAuth,
  onGetStarted,
  onToggleTheme
}: {
  session: SessionState | null;
  theme: AppTheme;
  onAuth: (session: SessionState) => void;
  onGetStarted: () => void;
  onToggleTheme: (event: ThemeToggleEvent) => void;
}) {
  const [showAuth, setShowAuth] = useState<"login" | "register" | null>(null);
  useRevealOnScroll<HTMLElement>();
  const themeLabel = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";

  function handleStart() {
    if (session) {
      onGetStarted();
      return;
    }

    setShowAuth("register");
  }

  return (
    <main className="landing">
      <div className="landing-bg" />
      <header className="landing-header">
        <Logo />
        <nav>
          <a href="#features">Возможности</a>
          <a href="#workflow">Как это работает</a>
          <a href="#security">Безопасность</a>
          <a href="#tariffs">Тарифы</a>
        </nav>
        <div className="landing-actions">
          <button className="icon-button theme-toggle" type="button" onClick={onToggleTheme} aria-label={themeLabel}>
            <Moon size={19} fill={theme === "dark" ? "currentColor" : "none"} />
          </button>
          <button className="ghost-button dark" onClick={session ? onGetStarted : () => setShowAuth("login")}>
            {session ? "В кабинет" : "Войти"}
          </button>
          <button className="primary-button" onClick={handleStart}>
            Приступить к работе
          </button>
        </div>
      </header>

      <section className="landing-hero" data-reveal>
        <div className="hero-copy" data-reveal-item>
          <h1>
            <span className="headline-main">Аналитика звонков</span>
            <span>без ручного прослушивания</span>
          </h1>
          <p>
            Загружайте звонки, получайте расшифровку, AI-анализ и статусы обработки.
            Управляйте командой, отделами и всей компанией в одном месте.
          </p>
          <div className="hero-actions">
            <button className="primary-button large" onClick={handleStart}>
              Приступить к работе
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <ProductPreview compact={false} />
      </section>

      <section className="benefits" id="features" data-reveal>
        <div className="section-heading" data-reveal-item>
          <span>Возможности</span>
          <h2>Что можно делать в CallLens</h2>
          <p>
            Рабочее пространство закрывает путь звонка от загрузки аудио до управленческого вывода:
            статусы, расшифровка, AI-анализ, инструкции и командный доступ собраны в одном интерфейсе.
          </p>
        </div>
        <div className="benefit-grid">
          <Benefit icon={<FileAudio />} title="Загрузка звонков" text="Добавляйте аудиофайлы и отслеживайте обработку по статусам." />
          <Benefit icon={<FileText />} title="Расшифровка" text="Читайте текст разговора по сегментам со спикерами и временем." />
          <Benefit icon={<Sparkles />} title="AI-анализ" text="Смотрите резюме, вопросы клиента, качество менеджера и следующие шаги." />
          <Benefit icon={<UsersRound />} title="Команды и отделы" text="Разделяйте доступ между компанией, отделами и личным пространством." />
        </div>
      </section>

      <section className="landing-section workflow-section" id="workflow" data-reveal>
        <div className="section-heading" data-reveal-item>
          <span>Как это работает</span>
          <h2>Понятный цикл обработки звонка</h2>
          <p>
            Каждый звонок проходит одинаковый маршрут: файл принят, аудио обработано,
            расшифровка готова, затем появляется AI-анализ с рекомендациями.
          </p>
        </div>
        <div className="workflow-grid">
          <WorkflowStep icon={<CloudUpload />} title="1. Загрузите аудио" text="Выберите файл, область видимости и инструкцию анализа для нужного отдела или компании." />
          <WorkflowStep icon={<RefreshCw />} title="2. Дождитесь обработки" text="Статусная линия показывает, где сейчас звонок: новый, в обработке, расшифрован или проанализирован." />
          <WorkflowStep icon={<Headphones />} title="3. Проверьте разговор" text="Откройте расшифровку по репликам, чтобы быстро найти важные вопросы и ответы." />
          <WorkflowStep icon={<WandSparkles />} title="4. Используйте выводы" text="AI-анализ подсветит следующий шаг, риски, возражения и качество работы менеджера." />
        </div>
      </section>

      <section className="landing-section security-section" id="security" data-reveal>
        <div className="security-copy">
          <div className="section-heading align-left" data-reveal-item>
            <span>Безопасность</span>
            <h2>Доступы и данные под контролем команды</h2>
            <p>
              Интерфейс построен вокруг ролей, компаний, отделов и областей видимости звонков.
              Это помогает показывать записи только тем пользователям, которым они нужны для работы.
            </p>
          </div>
          <div className="security-list">
            <SecurityItem icon={<LockKeyhole />} title="Авторизация" text="Работа с кабинетом начинается после входа или регистрации пользователя." />
            <SecurityItem icon={<Building2 />} title="Контекст компании" text="Звонки и инструкции можно привязывать к личному, отделному или корпоративному уровню." />
            <SecurityItem icon={<ShieldCheck />} title="Тарифные ограничения" text="Доступ к экспорту, командной аналитике и API зависит от активного тарифа." />
          </div>
        </div>
        <div className="security-panel" data-reveal-item>
          <span className="status-chip ok">Доступ настроен</span>
          <h3>Отдел продаж</h3>
          <p>Руководитель видит командные звонки, менеджер работает со своими записями и инструкциями.</p>
          <div className="access-row">
            <span><UsersRound size={17} /> Команда</span>
            <strong>Доступно</strong>
          </div>
          <div className="access-row">
            <span><FileText size={17} /> Экспорт</span>
            <strong>По тарифу</strong>
          </div>
          <div className="access-row">
            <span><BriefcaseBusiness size={17} /> Компания</span>
            <strong>Подключена</strong>
          </div>
        </div>
      </section>

      <section className="landing-section tariff-preview-section" id="tariffs" data-reveal>
        <div className="section-heading" data-reveal-item>
          <span>Тарифы</span>
          <h2>Выберите объем под свою работу</h2>
          <p>
            В кабинете доступны персональные и бизнес-тарифы. Карточки показывают лимиты,
            срок действия, уровень анализа и доступность командных возможностей.
          </p>
        </div>
        <LandingTariffPreview />
      </section>

      {showAuth && (
        <AuthDialog
          initialMode={showAuth}
          onClose={() => setShowAuth(null)}
          onAuth={onAuth}
        />
      )}
    </main>
  );
}

function AuthDialog({
  initialMode,
  onClose,
  onAuth
}: {
  initialMode: "login" | "register";
  onClose: () => void;
  onAuth: (session: SessionState) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("manager@test.com");
  const [password, setPassword] = useState("Qwerty123!");
  const [firstName, setFirstName] = useState("Иван");
  const [lastName, setLastName] = useState("Петров");
  const [nickName, setNickName] = useState("ivan");
  const [post, setPost] = useState("Отдел продаж");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const response =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({
              email,
              password,
              full_name: firstName,
              full_surname: lastName,
              nick_name: nickName,
              post
            });

      onAuth({
        user: response.user
      });
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? `${submitError.message}${submitError.code ? ` (${submitError.code})` : ""}`
          : "Не удалось выполнить вход";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className="auth-card">
        <button className="icon-button close" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>
        <Logo />
        <h2>{mode === "login" ? "Войти в CallLens" : "Создать аккаунт"}</h2>
        <p>Войдите или зарегистрируйтесь, чтобы перейти к рабочему пространству.</p>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <div className="form-grid two">
              <label>
                Имя
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </label>
              <label>
                Фамилия
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </label>
              <label>
                Ник
                <input value={nickName} onChange={(event) => setNickName(event.target.value)} />
              </label>
              <label>
                Должность
                <input value={post} onChange={(event) => setPost(event.target.value)} />
              </label>
            </div>
          )}

          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button wide" type="submit" disabled={busy}>
            {busy ? "Подключаем..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button
          className="text-button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Нужна регистрация?" : "Уже есть аккаунт?"}
        </button>
      </div>
    </div>
  );
}

function AuthenticatedShell({
  activePage,
  session,
  theme,
  invitationCount,
  companyCount,
  children,
  onNavigate,
  onOpenLanding,
  onToggleTheme,
  onLogout
}: {
  activePage: AppPage;
  session: SessionState;
  theme: AppTheme;
  invitationCount: number;
  companyCount: number;
  children: React.ReactNode;
  onNavigate: (page: AppPage) => void;
  onOpenLanding: () => void;
  onToggleTheme: (event: ThemeToggleEvent) => void;
  onLogout: () => void;
}) {
  const themeLabel = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <div className="app-shell">
      <header className="app-header">
        <Logo onClick={onOpenLanding} />
        <nav>
          {navItems.map((item) => (
            <button
              key={item.page}
              className={activePage === item.page ? "active" : ""}
              onClick={() => onNavigate(item.page)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="profile-block">
          <button
            className={`icon-button notification-button ${activePage === "invitations" ? "active" : ""}`}
            aria-label="Приглашения"
            onClick={() => onNavigate("invitations")}
          >
            <Bell size={19} />
            {invitationCount > 0 && <span className="notification-badge">{invitationCount}</span>}
          </button>
          <button className="icon-button theme-toggle" type="button" onClick={onToggleTheme} aria-label={themeLabel}>
            <Moon size={19} fill={theme === "dark" ? "currentColor" : "none"} />
          </button>
          <div className="avatar">{session.user.full_name[0] ?? "C"}</div>
          <div>
            <strong>
              {session.user.full_name} {session.user.full_surname}
            </strong>
            <span>{session.user.post ?? "Пользователь"}</span>
          </div>
          <button className="icon-button logout" onClick={onLogout} aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="workspace-frame">
        <aside className="app-sidebar" aria-label="Рабочие разделы">
          {sidebarItems.map((item) => {
            const badge =
              item.page === "invitations" && invitationCount > 0
                ? invitationCount
                : item.page === "companies" && companyCount > 0
                  ? companyCount
                  : 0;

            return (
              <button
                key={item.page}
                className={activePage === item.page ? "active" : ""}
                type="button"
                onClick={() => onNavigate(item.page)}
              >
                <span>
                  {item.icon}
                  <span className="sidebar-label">{item.label}</span>
                </span>
                {badge > 0 && <small>{badge}</small>}
              </button>
            );
          })}
        </aside>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}

function OverviewPage({
  calls,
  companies,
  departments,
  selectedCall,
  selectedCallTimeline,
  transcription,
  analysis,
  loading,
  loadingDetails,
  onNavigate
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  selectedCallTimeline?: CallStatus[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  loading: boolean;
  loadingDetails: boolean;
  onNavigate: (page: AppPage) => void;
}) {
  const analyzedCount = calls.filter((call) => call.status === "analyzed").length;
  const processingCount = calls.filter((call) => call.status === "processing").length;
  const transcribedCount = calls.filter(
    (call) => call.status === "transcribed" || call.status === "analyzed"
  ).length;

  return (
    <section className="overview-layout">
      <div className="welcome-panel">
        <h1>Добрый день!</h1>
        <p>
          Загружайте звонки, выбирайте личный, корпоративный или отделский контекст и
          отслеживайте обработку в одном месте.
        </p>
        <div className="overview-actions">
          <button className="primary-button" onClick={() => onNavigate("upload")}>
            <CloudUpload size={18} />
            Загрузить звонок
          </button>
          <button className="ghost-button" onClick={() => onNavigate("calls")}>
            Открыть звонки
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="metrics-row">
        {loading ? (
          <>
            <MetricSkeleton title="Всего звонков" />
            <MetricSkeleton title="Проанализировано" />
            <MetricSkeleton title="В обработке" />
            <MetricSkeleton title="Расшифровано" />
          </>
        ) : (
          <>
            <Metric title="Всего звонков" value={calls.length.toString()} />
            <Metric title="Проанализировано" value={analyzedCount.toString()} />
            <Metric title="В обработке" value={processingCount.toString()} />
            <Metric title="Расшифровано" value={transcribedCount.toString()} />
          </>
        )}
      </div>
      <div className="overview-preview glass">
        <CallDetailPanel
          call={selectedCall}
          companies={companies}
          departments={departments}
          transcription={transcription}
          analysis={analysis}
          timelineStatuses={selectedCallTimeline}
          loading={loading}
          loadingDetails={loadingDetails}
          onNavigate={onNavigate}
        />
      </div>
    </section>
  );
}

function CallsPage({
  calls,
  companies,
  departments,
  selectedCall,
  selectedCallId,
  selectedCallTimeline,
  transcription,
  analysis,
  loading,
  loadingDetails,
  onSelectCall,
  onNavigate,
  onDeleteCall
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  selectedCallTimeline?: CallStatus[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onNavigate: (page: AppPage) => void;
  onDeleteCall?: (callId: string) => Promise<void>;
}) {
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");
  const filteredCalls = calls.filter((call) => scopeFilter === "all" || call.visibility_scope === scopeFilter);

  return (
    <section className="calls-layout">
      <aside className="calls-sidebar glass">
        <div className="panel-heading">
          <h2>Звонки</h2>
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <CloudUpload size={16} />
            Загрузить звонок
          </button>
        </div>
        <div className="segmented compact">
          {[
            ["all", "Все"],
            ["personal", "Личные"],
            ["company", "Компания"],
            ["department", "Отдел"]
          ].map(([value, label]) => (
            <button
              key={value}
              className={scopeFilter === value ? "active" : ""}
              onClick={() => setScopeFilter(value as VisibilityScope | "all")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted-title">Недавние звонки</p>
        <div className="call-list">
          {loading && <CallListSkeleton count={4} />}
          {!loading &&
            filteredCalls.map((call) => (
              <button
                key={call.id}
                className={`call-row ${selectedCallId === call.id ? "selected" : ""}`}
                onClick={() => onSelectCall(call.id)}
              >
                <span className="play-dot">
                  <Play size={14} fill="currentColor" />
                </span>
                <span>
                  <strong>{call.title}</strong>
                  <small>
                    {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)}
                  </small>
                </span>
                <StatusChip status={call.status} />
                <MoreVertical size={16} />
              </button>
            ))}
          {!loading && filteredCalls.length === 0 && (
            <div className="empty-state">Звонков в этом контексте пока нет.</div>
          )}
        </div>
        <button className="ghost-button wide">
          Показать все звонки
          <ChevronRight size={16} />
        </button>
      </aside>

      <section className="call-overview glass">
        <CallDetailPanel
          call={selectedCall}
          companies={companies}
          departments={departments}
          transcription={transcription}
          analysis={analysis}
          timelineStatuses={selectedCallTimeline}
          loading={loading}
          loadingDetails={loadingDetails}
          onNavigate={onNavigate}
          onDeleteCall={onDeleteCall}
          showReports
        />
      </section>
    </section>
  );
}

function CallDetailPanel({
  call,
  companies,
  departments,
  transcription,
  analysis,
  timelineStatuses,
  loading,
  loadingDetails,
  onNavigate,
  onDeleteCall,
  showReports = false
}: {
  call?: CallResponse;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  timelineStatuses?: CallStatus[];
  loading?: boolean;
  loadingDetails?: boolean;
  onNavigate: (page: AppPage) => void;
  onDeleteCall?: (callId: string) => Promise<void>;
  showReports?: boolean;
}) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setShowFullTranscript(false);
    setShowFullAnalysis(false);
    setDeleteError("");
  }, [call?.id]);

  if (loading && !call) {
    return <CallDetailSkeleton />;
  }

  if (!call) {
    return (
      <div className="empty-panel">
        <Headphones size={34} />
        <h2>Звонков пока нет</h2>
        <p>Загрузите первый аудиофайл и выберите, кому он принадлежит.</p>
        <button className="primary-button" onClick={() => onNavigate("upload")}>
          <CloudUpload size={18} />
          Загрузить звонок
        </button>
      </div>
    );
  }

  async function deleteSelectedCall() {
    if (!call || !onDeleteCall || deleting) return;

    const confirmed = window.confirm(`Удалить звонок "${call.title}"? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await onDeleteCall(call.id);
    } catch (deleteCallError) {
      setDeleteError(deleteCallError instanceof Error ? deleteCallError.message : "Не удалось удалить звонок");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="panel-heading large">
        <h2>Обзор звонка</h2>
        <div className="panel-actions">
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <CloudUpload size={16} />
            Загрузить звонок
          </button>
          {onDeleteCall && (
            <button className="ghost-button small danger-button" onClick={deleteSelectedCall} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Удаляю..." : "Удалить"}
            </button>
          )}
        </div>
      </div>
      {deleteError && <div className="form-error">{deleteError}</div>}
      <div className="selected-call-card">
        <div className="play-large">
          <Play size={22} fill="currentColor" />
        </div>
        <div>
          <span>Выбранный звонок</span>
          <strong>{call.title}</strong>
          <small>
            {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)} ·{" "}
            {contextLabel(call, companies, departments)}
          </small>
        </div>
        <StatusChip status={call.status} />
      </div>
      <StatusTimeline current={call.status} statuses={timelineStatuses} />
      {showReports && <ReportExportPanel call={call} analysis={analysis} />}
      <div className="detail-grid">
        <InfoCard
          title="Расшифровка"
          status={transcription?.status === "transcribed" ? "Готово" : "Ожидает"}
          action={showFullTranscript ? "Свернуть расшифровку" : "Открыть полную расшифровку"}
          onAction={() => setShowFullTranscript((current) => !current)}
        >
          <TranscriptPreview transcription={transcription} expanded={showFullTranscript} loading={loadingDetails} />
        </InfoCard>
        <InfoCard
          title="AI-анализ"
          status={isAnalysisDone(analysis) ? "Анализ готов" : "Ожидает"}
          action={showFullAnalysis ? "Свернуть анализ" : "Открыть полный анализ"}
          onAction={() => setShowFullAnalysis((current) => !current)}
        >
          <AnalysisPreview analysis={analysis} expanded={showFullAnalysis} loading={loadingDetails} />
        </InfoCard>
      </div>
      <div className="next-step">
        <span className="step-icon">
          <WandSparkles size={19} />
        </span>
        <div>
          <h3>Следующий шаг</h3>
          <p>{analysisNextStep(analysis)}</p>
        </div>
        <button className="ghost-button">
          Выполнить действие
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

function UploadPage({
  session,
  companies,
  departments,
  instructions,
  loading,
  onNavigate,
  onUploaded
}: {
  session: SessionState;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  instructions: AnalysisInstruction[];
  loading: boolean;
  onNavigate: (page: AppPage) => void;
  onUploaded: (call: CallResponse) => void;
}) {
  const [title, setTitle] = useState("Обсуждение условий договора с клиентом");
  const [audio, setAudio] = useState<File | null>(null);
  const [scope, setScope] = useState<VisibilityScope>("personal");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(
    departments.find((department) => department.company_uuid === companies[0]?.id)?.id ?? ""
  );
  const [selectedInstructionIds, setSelectedInstructionIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const companiesWithDepartments = useMemo(
    () =>
      companies.filter((company) =>
        departments.some((department) => department.company_uuid === company.id)
      ),
    [companies, departments]
  );
  const availableCallScopes = useMemo<VisibilityScope[]>(
    () => [
      "personal",
      ...(companies.length > 0 ? (["company"] as VisibilityScope[]) : []),
      ...(companiesWithDepartments.length > 0 ? (["department"] as VisibilityScope[]) : [])
    ],
    [companies.length, companiesWithDepartments.length]
  );
  const selectableCompanies = scope === "department" ? companiesWithDepartments : companies;
  const availableDepartments = departments.filter((department) => department.company_uuid === companyId);
  const availableInstructions = availableInstructionsForContext(
    instructions,
    scope,
    companyId,
    departmentId
  );
  const availableInstructionKey = availableInstructions.map((instruction) => instruction.id).join("|");
  const selectedInstructions = availableInstructions.filter((instruction) =>
    selectedInstructionIds.includes(instruction.id)
  );

  useEffect(() => {
    if (!availableCallScopes.includes(scope)) {
      setScope("personal");
    }
  }, [availableCallScopes, scope]);

  useEffect(() => {
    if (scope === "personal") return;

    if (!selectableCompanies.some((company) => company.id === companyId)) {
      setCompanyId(selectableCompanies[0]?.id ?? "");
    }
  }, [companyId, scope, selectableCompanies]);

  useEffect(() => {
    if (scope === "department" && !departmentId && availableDepartments[0]) {
      setDepartmentId(availableDepartments[0].id);
    }
  }, [availableDepartments, departmentId, scope]);

  useEffect(() => {
    setSelectedInstructionIds((current) => {
      const availableIds = availableInstructions.map((instruction) => instruction.id);
      const available = new Set(availableIds);
      const preserved = current.filter((id) => available.has(id));

      return preserved.length > 0 ? preserved : availableIds;
    });
  }, [availableInstructionKey]);

  function toggleInstruction(instructionId: string) {
    setSelectedInstructionIds((current) =>
      current.includes(instructionId)
        ? current.filter((id) => id !== instructionId)
        : [...current, instructionId]
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Введите название звонка.");
      return;
    }

    if (!audio) {
      setError("Выберите аудиофайл.");
      return;
    }

    const payload = {
      title: title.trim(),
      audio,
      companyUuid: scope === "company" || scope === "department" ? companyId : undefined,
      departmentUuid: scope === "department" ? departmentId : undefined
    };

    if ((scope === "company" || scope === "department") && !companyId) {
      setError("Выберите компанию.");
      return;
    }

    if (scope === "department" && !departmentId) {
      setError("Выберите отдел.");
      return;
    }

    setBusy(true);
    try {
      const created = await api.createCall(payload);
      onUploaded(created);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить звонок");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="upload-layout">
      <aside className="step-rail glass">
        <div className="step-rail-title">
          <Upload size={28} />
          <div>
            <h2>Загрузка звонка</h2>
            <p>Загрузите аудио и укажите, кому принадлежит этот звонок.</p>
          </div>
        </div>
        <StepItem active number="1" title="Файл и принадлежность" text="Загрузите файл и выберите, куда добавить звонок." />
        <StepItem number="2" title="Инструкция для анализа" text="Будет применена подходящая инструкция." />
        <StepItem number="3" title="Обработка и анализ" text="Звонок будет обработан и проанализирован." />
        <StepItem done title="Готово" text="Результаты появятся в обзоре звонка." />
      </aside>

      <form className="upload-form glass" onSubmit={submit}>
        <h1>Загрузить звонок</h1>
        <label>
          Название звонка
          <div className="input-with-counter">
            <input
              value={title}
              maxLength={255}
              onChange={(event) => setTitle(event.target.value)}
            />
            <span>{title.length} / 255</span>
          </div>
        </label>
        <div>
          <span className="field-title">Аудиофайл</span>
          <FileDropZone
            file={audio}
            icon={<FileAudio size={24} />}
            accept=".mp3,.wav,.m4a,.ogg,audio/*"
            buttonLabel="Выбрать аудиофайл"
            emptyLabel="Перетащите аудиофайл сюда"
            onFile={setAudio}
          />
          <small>Поддерживаются: MP3, WAV, M4A, OGG. Максимальный размер: 100 МБ.</small>
        </div>
        <div>
          <span className="field-title">Куда добавить звонок?</span>
          <div className="segmented scope">
            {availableCallScopes.map((item) => (
              <button
                type="button"
                key={item}
                className={scope === item ? "active" : ""}
                onClick={() => setScope(item)}
              >
                {item === "personal" && <CircleUserRound size={17} />}
                {item === "company" && <BriefcaseBusiness size={17} />}
                {item === "department" && <UsersRound size={17} />}
                {callScopeLabel(item)}
              </button>
            ))}
          </div>
        </div>
        {scope !== "personal" && (
          <div className="form-grid two">
            <label>
              Компания
              <SelectControl value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {selectableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            {scope === "department" && (
              <label>
                Отдел
                <SelectControl value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {availableDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectControl>
              </label>
            )}
          </div>
        )}
        <div className="context-note">
          <CircleAlert size={18} />
          <span>
            Выбранный контекст определяет, кто сможет просматривать звонок и какая инструкция
            будет использована для анализа.
          </span>
        </div>
        <div className="instruction-preview">
          <FileText size={21} />
          <div>
            <strong>Инструкции для выбранного контекста</strong>
            <small>{instructionContextHint(scope)}</small>
          </div>
          <button className="ghost-button small" type="button" onClick={() => onNavigate("instructions")}>
            <Pencil size={15} />
            Изменить инструкцию
          </button>
        </div>
        <InstructionChoiceList
          instructions={availableInstructions}
          selectedInstructionIds={selectedInstructionIds}
          companies={companies}
          departments={departments}
          loading={loading}
          onToggle={toggleInstruction}
        />
        <InstructionMiniList
          title="Выбрано для анализа"
          instructions={selectedInstructions}
          companies={companies}
          departments={departments}
          emptyText="Инструкции не выбраны."
        />
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            <CloudUpload size={18} />
            {busy ? "Загружаю..." : "Загрузить и поставить в очередь"}
          </button>
          <button className="ghost-button" type="button" onClick={() => onNavigate("calls")}>
            Отмена
          </button>
        </div>
      </form>

    </section>
  );
}

function AnalysisPage({
  session,
  calls,
  selectedCall,
  selectedCallId,
  selectedCallTimeline,
  analyses,
  instructions,
  companies,
  departments,
  loading,
  loadingDetails,
  onSelectCall,
  onAnalysisReady,
  onDeleteCall,
  onNavigate
}: {
  session: SessionState;
  calls: CallResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  selectedCallTimeline?: CallStatus[];
  analyses: Record<string, AnalysisResponse>;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onAnalysisReady: (callId: string, analysis: AnalysisResponse) => void;
  onDeleteCall: (callId: string) => Promise<void>;
  onNavigate: (page: AppPage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const analysis = selectedCall ? analyses[selectedCall.id] : undefined;
  const availableInstructions = selectedCall
    ? availableInstructionsForCall(instructions, selectedCall)
    : [];

  useEffect(() => {
    setShowFullAnalysis(false);
  }, [selectedCall?.id]);

  async function runAnalysis() {
    if (!selectedCall) return;
    setError("");
    setBusy(true);
    try {
      const result = await api.analyzeCall(selectedCall.id);
      onAnalysisReady(selectedCall.id, result);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось запустить анализ");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedCall() {
    if (!selectedCall || deleting) return;

    const confirmed = window.confirm(`Удалить звонок "${selectedCall.title}"? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await onDeleteCall(selectedCall.id);
    } catch (deleteCallError) {
      setDeleteError(deleteCallError instanceof Error ? deleteCallError.message : "Не удалось удалить звонок");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="analysis-layout">
      <aside className="calls-sidebar glass">
        <div className="panel-heading">
          <h2>AI-анализ</h2>
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <Plus size={16} />
            Звонок
          </button>
        </div>
        <div className="call-list compact-list">
          {loading ? (
            <CallListSkeleton compact count={4} />
          ) : (
            calls.map((call) => (
              <button
                key={call.id}
                className={`call-row ${selectedCallId === call.id ? "selected" : ""}`}
                onClick={() => onSelectCall(call.id)}
              >
                <span className="play-dot">
                  <Sparkles size={14} />
                </span>
                <span>
                  <strong>{call.title}</strong>
                  <small>{statusMeta[call.status].chip}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
      <section className="analysis-detail glass">
        <div className="panel-heading large">
          <div>
            <h1>{selectedCall?.title ?? "Выберите звонок"}</h1>
            <p>Сводка, темы, вопросы клиента, качество менеджера и следующие шаги по выбранному звонку.</p>
          </div>
          <div className="panel-actions">
            <button className="primary-button" onClick={runAnalysis} disabled={!selectedCall || busy}>
              <WandSparkles size={18} />
              {busy ? "Анализирую..." : "Запустить анализ"}
            </button>
            <button className="ghost-button danger-button" onClick={deleteSelectedCall} disabled={!selectedCall || deleting}>
              <Trash2 size={18} />
              {deleting ? "Удаляю..." : "Удалить"}
            </button>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {deleteError && <div className="form-error">{deleteError}</div>}
        {selectedCall && (
          <StatusTimeline current={selectedCall.status} statuses={selectedCallTimeline} />
        )}
        {selectedCall && <ReportExportPanel call={selectedCall} analysis={analysis} />}
        <div className="analysis-content-grid">
          <div className="info-card">
            <div className="card-title">
              <h3>Результат</h3>
              <span className="status-chip ok">{isAnalysisDone(analysis) ? "Готово" : "Нет анализа"}</span>
            </div>
            {loadingDetails || (loading && !selectedCall) ? (
              <AnalysisResultSkeleton />
            ) : (
              <div className="analysis-user-summary">
                <div className={`analysis-full-text expandable-content ${showFullAnalysis ? "expanded" : "collapsed"}`}>
                  <AnalysisStructuredView analysis={analysis} />
                </div>
                <button className="text-link" type="button" onClick={() => setShowFullAnalysis((current) => !current)}>
                  {showFullAnalysis ? "Свернуть анализ" : "Открыть полный анализ"}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="info-card">
            <div className="card-title">
              <h3>Инструкции для этого звонка</h3>
              <span className="status-chip ok">{contextInstructionCaption(selectedCall)}</span>
            </div>
            <InstructionMiniList
              instructions={availableInstructions}
              companies={companies}
              departments={departments}
            />
          </div>
        </div>
      </section>
    </section>
  );
}

const reportFormats: Array<{ format: ReportFormat; label: string; description: string }> = [
  { format: "pdf", label: "PDF", description: "Для отправки или печати" },
  { format: "docx", label: "DOCX", description: "Редактируемый документ" },
  { format: "md", label: "Markdown", description: "Для заметок и копирования" },
  { format: "xlsx", label: "Excel", description: "Метаданные, анализ и транскрипция" }
];

function ReportExportPanel({
  call,
  analysis
}: {
  call: CallResponse;
  analysis?: AnalysisResponse;
}) {
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [busyFormat, setBusyFormat] = useState<ReportFormat | null>(null);
  const [busyReportId, setBusyReportId] = useState("");
  const [error, setError] = useState("");
  const [exportEnabled, setExportEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoadingReports(true);
      setError("");
      try {
        const response = await api.listReports(call.id);
        if (!cancelled) setReports(response.reports);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить отчеты");
        }
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [call.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadExportAccess() {
      setExportEnabled(null);
      try {
        const subscription =
          call.visibility_scope === "personal"
            ? await api.getSubscription()
            : call.company_uuid
              ? await api.getCompanySubscription(call.company_uuid)
              : null;

        if (!cancelled) setExportEnabled(subscription?.plan.export_enabled ?? false);
      } catch {
        if (!cancelled) setExportEnabled(false);
      }
    }

    loadExportAccess();

    return () => {
      cancelled = true;
    };
  }, [call.company_uuid, call.id, call.visibility_scope]);

  async function refreshReports() {
    const response = await api.listReports(call.id);
    setReports(response.reports);
  }

  async function createReport(format: ReportFormat) {
    setError("");
    setBusyFormat(format);
    try {
      const created = await api.createReport(call.id, { format });
      await refreshReports();
      if (created.status === "ready") {
        await downloadReport(created);
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось создать отчет");
    } finally {
      setBusyFormat(null);
    }
  }

  async function downloadReport(report: ReportResponse) {
    setError("");
    setBusyReportId(report.id);
    try {
      const blob = await api.downloadReport(report);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = report.file_name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Не удалось скачать отчет");
    } finally {
      setBusyReportId("");
    }
  }

  async function deleteReport(reportId: string) {
    setError("");
    setBusyReportId(reportId);
    try {
      await api.deleteReport(reportId);
      setReports((current) => current.filter((report) => report.id !== reportId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить отчет");
    } finally {
      setBusyReportId("");
    }
  }

  const analysisReady = isAnalysisDone(analysis);
  const exportBlocked = exportEnabled === false;

  return (
    <section className="report-panel">
      <div className="card-title">
        <div>
          <h3>Экспорт отчета</h3>
          <p>Файл строится из готового анализа звонка и доступной транскрипции.</p>
        </div>
        <span className={`status-chip ${analysisReady ? "ok" : "warn"}`}>
          {analysisReady ? "Анализ готов" : "Нужен готовый анализ"}
        </span>
      </div>
      <div className="report-format-grid">
        {reportFormats.map((item) => (
          <button
            className="report-format-button"
            key={item.format}
            onClick={() => createReport(item.format)}
            disabled={!analysisReady || exportBlocked || busyFormat !== null}
          >
            <FileDown size={18} />
            <span>
              <strong>{item.label}</strong>
              <small>{busyFormat === item.format ? "Создаю отчет..." : item.description}</small>
            </span>
          </button>
        ))}
      </div>
      {exportBlocked && (
        <div className="form-error">Экспорт отчетов недоступен на текущем тарифе.</div>
      )}
      {error && <div className="form-error">{error}</div>}
      <div className="report-list">
        <div className="report-list-title">
          <strong>Готовые и текущие отчеты</strong>
          {loadingReports && <span>Загружаю...</span>}
        </div>
        {!loadingReports && reports.length === 0 && (
          <div className="empty-state compact">Для этого звонка еще нет экспортированных отчетов.</div>
        )}
        {reports.map((report) => (
          <div className="report-row" key={report.id}>
            <FileText size={18} />
            <div>
              <strong>{report.file_name}</strong>
              <small>
                {reportFormatLabel(report.format)} · {formatBytes(report.size_bytes)} · создан{" "}
                {formatDate(report.created_at)} · хранится до {formatDate(report.expires_at)}
              </small>
              {report.error_message && <small className="report-error">{report.error_message}</small>}
            </div>
            <span className={`status-chip ${report.status === "ready" ? "ok" : report.status === "failed" ? "bad" : "warn"}`}>
              {reportStatusLabel(report.status)}
            </span>
            <div className="report-actions">
              <button
                className="icon-button"
                aria-label="Скачать отчет"
                onClick={() => downloadReport(report)}
                disabled={report.status !== "ready" || busyReportId === report.id}
              >
                <Download size={17} />
              </button>
              <button
                className="icon-button danger-icon"
                aria-label="Удалить отчет"
                onClick={() => deleteReport(report.id)}
                disabled={busyReportId === report.id}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InstructionsPage({
  session,
  instructions,
  companies,
  departments,
  loading,
  onInstructionCreated
}: {
  session: SessionState;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading: boolean;
  onInstructionCreated: (instruction: AnalysisInstruction) => void;
}) {
  const [title, setTitle] = useState("Инструкция анализа продаж");
  const managedCompanies = useMemo(
    () => companies.filter((company) => company.manager_user_uuid === session.user.id),
    [companies, session.user.id]
  );
  const managedCompanyIds = useMemo(
    () => new Set(managedCompanies.map((company) => company.id)),
    [managedCompanies]
  );
  const managedDepartments = useMemo(
    () => departments.filter((department) => managedCompanyIds.has(department.company_uuid)),
    [departments, managedCompanyIds]
  );
  const companiesWithDepartments = useMemo(
    () =>
      managedCompanies.filter((company) =>
        managedDepartments.some((department) => department.company_uuid === company.id)
      ),
    [managedCompanies, managedDepartments]
  );
  const [scope, setScope] = useState<InstructionScope>("personal");
  const [companyId, setCompanyId] = useState(managedCompanies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(managedDepartments[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const availableInstructionScopes: InstructionScope[] = [
    "personal",
    ...(managedCompanies.length > 0 ? (["company"] as InstructionScope[]) : []),
    ...(managedDepartments.length > 0 ? (["department"] as InstructionScope[]) : [])
  ];
  const selectableCompanies = scope === "department" ? companiesWithDepartments : managedCompanies;
  const availableDepartments = managedDepartments.filter((department) => department.company_uuid === companyId);
  const personalInstructions = instructions.filter((instruction) => instruction.scope === "personal");
  const companyInstructions = instructions.filter((instruction) => instruction.scope === "company");
  const departmentInstructions = instructions.filter((instruction) => instruction.scope === "department");
  const instructionSections = [
    {
      title: "Личная инструкция",
      instructions: personalInstructions
    },
    {
      title: "Инструкция компании",
      instructions: companyInstructions
    },
    {
      title: "Инструкция Отдела",
      instructions: departmentInstructions
    }
  ].filter((section) => section.instructions.length > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Введите название инструкции.");
      return;
    }

    if (!file) {
      setError("Выберите markdown-файл.");
      return;
    }

    if (scope !== "personal" && !companyId) {
      setError("Выберите компанию.");
      return;
    }

    if (scope === "department" && !departmentId) {
      setError("Выберите отдел.");
      return;
    }

    setBusy(true);
    try {
      const created = await api.createInstruction({
        title,
        file,
        scope,
        companyUuid: scope !== "personal" ? companyId : undefined,
        departmentUuid: scope === "department" ? departmentId : undefined
      });
      onInstructionCreated(created);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось загрузить инструкцию");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!availableInstructionScopes.includes(scope)) {
      setScope("personal");
    }
  }, [availableInstructionScopes, scope]);

  useEffect(() => {
    if (scope === "personal") return;

    if (!selectableCompanies.some((company) => company.id === companyId)) {
      setCompanyId(selectableCompanies[0]?.id ?? "");
    }
  }, [companyId, scope, selectableCompanies]);

  useEffect(() => {
    if (scope !== "department") return;

    if (!availableDepartments.some((department) => department.id === departmentId)) {
      setDepartmentId(availableDepartments[0]?.id ?? "");
    }
  }, [availableDepartments, departmentId, scope]);

  return (
    <section className="instructions-layout">
      <form className="instructions-form glass" onSubmit={submit}>
        <h1>Инструкции для анализа</h1>
        <p>Инструкция определяет, как AI будет оценивать звонок в выбранном контексте.</p>
        <label>
          Название инструкции
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="segmented scope">
          {availableInstructionScopes.map((item) => (
            <button
              type="button"
              key={item}
              className={scope === item ? "active" : ""}
              onClick={() => setScope(item)}
            >
              {instructionScopeLabel(item)}
            </button>
          ))}
        </div>
        {scope !== "personal" && (
          <div className="form-grid two">
            <label>
              Компания
              <SelectControl value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {selectableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            {scope === "department" && (
              <label>
                Отдел
                <SelectControl value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {availableDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectControl>
              </label>
            )}
          </div>
        )}
        <div>
          <span className="field-title">Markdown-файл</span>
          <FileDropZone
            file={file}
            icon={<FileText size={22} />}
            accept=".md,text/markdown,text/plain"
            buttonLabel="Выбрать файл"
            emptyLabel="Перетащите markdown-файл сюда"
            onFile={setFile}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" disabled={busy}>
          {busy ? "Загружаю..." : "Сохранить инструкцию"}
        </button>
      </form>
      <div className="instructions-list glass">
        <h2>Активные инструкции</h2>
        {loading ? (
          <InstructionListSkeleton count={4} />
        ) : instructionSections.length === 0 ? (
          <div className="instruction-empty standalone">Инструкций пока нет.</div>
        ) : (
          instructionSections.map((section) => (
            <InstructionSection
              key={section.title}
              title={section.title}
              instructions={section.instructions}
              companies={companies}
              departments={departments}
            />
          ))
        )}
      </div>
    </section>
  );
}

function InstructionSection({
  title,
  instructions,
  companies,
  departments
}: {
  title: string;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
}) {
  return (
    <section className="instruction-section">
      <div className="instruction-section-title">
        <span />
        <strong>{title}</strong>
        <span />
      </div>
      {instructions.map((instruction) => (
        <InstructionRow
          key={instruction.id}
          instruction={instruction}
          companies={companies}
          departments={departments}
        />
      ))}
    </section>
  );
}

function InstructionRow({
  instruction,
  companies,
  departments
}: {
  instruction: AnalysisInstruction;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
}) {
  return (
    <div className="instruction-row">
      <FileText size={20} />
      <div>
        <strong>{instruction.title}</strong>
        <small>
          {instructionContextLabel(instruction, companies, departments)} · {instruction.original_filename}
        </small>
      </div>
      <span className="status-chip ok">Активна</span>
    </div>
  );
}

function InvitationsPage({
  invitations,
  companies,
  departments,
  session,
  loading,
  onInvitationCreated,
  onInvitationAccepted,
  onInvitationDeclined
}: {
  invitations: Invitation[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  session: SessionState;
  loading: boolean;
  onInvitationCreated: (invitation: Invitation) => void;
  onInvitationAccepted: (invitation: Invitation) => Promise<void>;
  onInvitationDeclined: (invitation: Invitation) => void;
}) {
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");

  return (
    <section className="invitations-layout">
      <div className="invitations-list glass">
        <div className="panel-heading large">
          <div>
            <h1>Приглашения</h1>
            <p>Входящие заявки в компанию или отдел.</p>
          </div>
          <span className="status-chip warn">{pendingInvitations.length}</span>
        </div>
        {loading ? (
          <CallListSkeleton count={3} compact />
        ) : pendingInvitations.length === 0 ? (
          <div className="empty-panel">
            <Bell size={34} />
            <h2>Нет входящих приглашений</h2>
          </div>
        ) : (
          <div className="invitation-card-list">
            {pendingInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                companies={companies}
                departments={departments}
                onAccepted={onInvitationAccepted}
                onDeclined={onInvitationDeclined}
              />
            ))}
          </div>
        )}
      </div>
      <InvitationCreatePanel
        companies={companies}
        departments={departments}
        session={session}
        onInvitationCreated={onInvitationCreated}
      />
    </section>
  );
}

function InvitationCard({
  invitation,
  companies,
  departments,
  onAccepted,
  onDeclined
}: {
  invitation: Invitation;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onAccepted: (invitation: Invitation) => Promise<void>;
  onDeclined: (invitation: Invitation) => void;
}) {
  const [busyAction, setBusyAction] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  const companyName = companies.find((company) => company.id === invitation.company_uuid)?.name;
  const departmentName = departments.find((department) => department.id === invitation.department_uuid)?.name;
  const isDepartmentInvitation = Boolean(invitation.department_uuid);

  async function acceptInvitation() {
    setError("");
    setBusyAction("accept");
    try {
      const accepted = await api.acceptInvitation(invitation.id);
      await onAccepted(accepted);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Не удалось принять приглашение");
    } finally {
      setBusyAction(null);
    }
  }

  async function declineInvitation() {
    setError("");
    setBusyAction("decline");
    try {
      const declined = await api.declineInvitation(invitation.id);
      onDeclined(declined);
    } catch (declineError) {
      setError(declineError instanceof Error ? declineError.message : "Не удалось отклонить приглашение");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <article className="invitation-card">
      <div className="invitation-icon">
        {isDepartmentInvitation ? <UsersRound size={20} /> : <BriefcaseBusiness size={20} />}
      </div>
      <div className="invitation-main">
        <div className="invitation-title-row">
          <span className="status-chip warn">{isDepartmentInvitation ? "Отдел" : "Компания"}</span>
          <span className="status-chip ok">{invitationRoleLabel(invitation)}</span>
        </div>
        <h2>{isDepartmentInvitation ? departmentName ?? "Отдел" : companyName ?? "Компания"}</h2>
        <p>
          {companyName ?? invitation.company_uuid}
          {isDepartmentInvitation && ` · ${departmentName ?? invitation.department_uuid}`}
        </p>
        <small>Срок действия: {formatDate(invitation.expires_at)}</small>
        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="invitation-actions">
        <button className="primary-button small" onClick={acceptInvitation} disabled={Boolean(busyAction)}>
          <Check size={16} />
          {busyAction === "accept" ? "Принимаю..." : "Принять"}
        </button>
        <button className="ghost-button small" onClick={declineInvitation} disabled={Boolean(busyAction)}>
          <X size={16} />
          {busyAction === "decline" ? "Отклоняю..." : "Отклонить"}
        </button>
      </div>
    </article>
  );
}

function InvitationCreatePanel({
  companies,
  departments,
  session,
  onInvitationCreated
}: {
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  session: SessionState;
  onInvitationCreated: (invitation: Invitation) => void;
}) {
  const [mode, setMode] = useState<"company" | "department">("company");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [userUuid, setUserUuid] = useState("");
  const [departmentRole, setDepartmentRole] = useState<InvitationDepartmentRole>("employee");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const availableDepartments = departments.filter((department) => department.company_uuid === companyId);
  const selectedCompany = companies.find((company) => company.id === companyId);
  const canInviteDepartmentLeader = selectedCompany?.manager_user_uuid === session.user.id;

  useEffect(() => {
    if (!companyId && companies[0]) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  useEffect(() => {
    if (availableDepartments[0] && !availableDepartments.some((department) => department.id === departmentId)) {
      setDepartmentId(availableDepartments[0].id);
    }
  }, [availableDepartments, departmentId]);

  useEffect(() => {
    if (!canInviteDepartmentLeader && departmentRole !== "employee") {
      setDepartmentRole("employee");
    }
  }, [canInviteDepartmentLeader, departmentRole]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!companyId) {
      setError("Выберите компанию.");
      return;
    }

    if (mode === "department" && !departmentId) {
      setError("Выберите отдел.");
      return;
    }

    if (!userUuid.trim()) {
      setError("Введите user uuid.");
      return;
    }

    setBusy(true);
    try {
      const created =
        mode === "company"
          ? await api.createCompanyInvitation(companyId, userUuid.trim())
          : await api.createDepartmentInvitation(companyId, departmentId, userUuid.trim(), departmentRole);
      onInvitationCreated(created);
      setSuccess("Приглашение отправлено.");
      setUserUuid("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось отправить приглашение");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invitation-create glass" onSubmit={submit}>
      <h2>Отправить приглашение</h2>
      <div className="segmented scope">
        <button
          type="button"
          className={mode === "company" ? "active" : ""}
          onClick={() => setMode("company")}
        >
          Компания
        </button>
        <button
          type="button"
          className={mode === "department" ? "active" : ""}
          onClick={() => setMode("department")}
        >
          Отдел
        </button>
      </div>
      <label>
        Компания
        <SelectControl value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </SelectControl>
      </label>
      {mode === "department" && (
        <>
          <label>
            Отдел
            <SelectControl value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {availableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </SelectControl>
          </label>
          <label>
            Роль
            <SelectControl
              value={departmentRole}
              onChange={(event) => setDepartmentRole(event.target.value as InvitationDepartmentRole)}
            >
              <option value="employee">Сотрудник</option>
              {canInviteDepartmentLeader && <option value="department_leader">Руководитель отдела</option>}
            </SelectControl>
          </label>
        </>
      )}
      <label>
        User UUID
        <input value={userUuid} onChange={(event) => setUserUuid(event.target.value)} />
      </label>
      {companies.length === 0 && <div className="instruction-empty standalone">Компаний пока нет.</div>}
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
      <button className="primary-button" type="submit" disabled={busy || companies.length === 0}>
        <Plus size={18} />
        {busy ? "Отправляю..." : "Отправить приглашение"}
      </button>
    </form>
  );
}

function ProfilePage({
  session,
  companies,
  onCompanyCreated,
  onNavigate
}: {
  session: SessionState;
  companies: CompanyResponse[];
  onCompanyCreated: (company: CompanyResponse) => void | Promise<void>;
  onNavigate: (page: AppPage) => void;
}) {
  const managedCompanies = companies.filter((company) => company.manager_user_uuid === session.user.id);
  const memberCompanies = companies.filter((company) => company.manager_user_uuid !== session.user.id);

  return (
    <section className="profile-layout">
      <div className="profile-hero glass">
        <div className="avatar large">{session.user.full_name[0] ?? "C"}</div>
        <div>
          <h1>
            {session.user.full_name} {session.user.full_surname}
          </h1>
          <p>{session.user.post ?? "Должность не указана"}</p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card glass">
          <div className="panel-heading">
            <h2>Профиль</h2>
            <span className="status-chip ok">Активен</span>
          </div>
          <ProfileField label="Email" value={session.user.email} />
          <ProfileField label="Ник" value={session.user.nick_name} />
          <ProfileField label="Роль" value={session.user.role} />
          <ProfileField label="Дата регистрации" value={formatDate(session.user.created_at)} />
        </section>

        <section className="profile-card glass">
          <div className="panel-heading">
            <h2>Компания</h2>
            {companies.length > 0 && <span className="status-chip warn">{companies.length}</span>}
          </div>
          {companies.length === 0 ? (
            <CompanyEmptyState onCompanyCreated={onCompanyCreated} compact />
          ) : (
            <div className="company-mini-list">
              {managedCompanies.map((company) => (
                <CompanyMiniCard key={company.id} company={company} manager />
              ))}
              {memberCompanies.map((company) => (
                <CompanyMiniCard key={company.id} company={company} manager={false} />
              ))}
            </div>
          )}
          <button className="ghost-button" type="button" onClick={() => onNavigate("companies")}>
            Открыть компании
            <ChevronRight size={16} />
          </button>
        </section>
      </div>
    </section>
  );
}

function CompaniesPage({
  session,
  companies,
  departments,
  onCompanyCreated,
  onNavigate
}: {
  session: SessionState;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onCompanyCreated: (company: CompanyResponse) => void | Promise<void>;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <section className="companies-layout">
      <div className="companies-hero glass">
        <div>
          <h1>Компании</h1>
          <p>
            Компания создается без оплаты. Рабочие действия внутри компании доступны после
            активной бизнес-подписки этой компании.
          </p>
        </div>
        <CreateCompanyForm onCreated={onCompanyCreated} />
      </div>

      {companies.length === 0 ? (
        <CompanyEmptyState onCompanyCreated={onCompanyCreated} />
      ) : (
        <div className="company-grid">
          {companies.map((company) => {
            const companyDepartments = departments.filter(
              (department) => department.company_uuid === company.id
            );
            const isManager = company.manager_user_uuid === session.user.id;

            return (
              <article className="company-card glass" key={company.id}>
                <div className="panel-heading">
                  <div>
                    <h2>{company.name}</h2>
                    <p>{isManager ? "Вы управляете компанией" : "Вы участник компании"}</p>
                  </div>
                  <span className={`status-chip ${isManager ? "ok" : "warn"}`}>
                    {isManager ? "Менеджер" : "Участник"}
                  </span>
                </div>
                <div className="company-meta-grid">
                  <ProfileField label="UUID" value={company.id} />
                  <ProfileField label="Создана" value={formatDate(company.created_at)} />
                  <ProfileField label="Лимит участников" value={company.member_limit.toString()} />
                  <ProfileField label="Отделов" value={companyDepartments.length.toString()} />
                </div>
                <CompanySubscriptionStatus company={company} isManager={isManager} onNavigate={onNavigate} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CompanySubscriptionStatus({
  company,
  isManager,
  onNavigate
}: {
  company: CompanyResponse;
  isManager: boolean;
  onNavigate: (page: AppPage) => void;
}) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(isManager);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isManager) return;

    let cancelled = false;

    async function loadSubscription() {
      try {
        setLoading(true);
        setError("");
        const response = await api.getCompanySubscription(company.id);
        if (!cancelled) setSubscription(response);
      } catch (loadError) {
        if (cancelled) return;
        if (
          loadError instanceof ApiError &&
          (loadError.status === 404 || loadError.code === "subscription_not_found")
        ) {
          setSubscription(null);
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить подписку");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [company.id, isManager]);

  if (!isManager) {
    return (
      <div className="company-lock-note">
        <LockKeyhole size={18} />
        <p>Статус бизнес-подписки видит менеджер компании.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="company-lock-note">Проверяю бизнес-подписку...</div>;
  }

  if (error) {
    return <div className="form-error">{error}</div>;
  }

  const active = subscription?.status === "active";

  return (
    <div className={`company-lock-note ${active ? "active" : ""}`}>
      {active ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
      <div>
        <strong>{active ? "Бизнес-подписка активна" : "Компания пока заблокирована"}</strong>
        <p>
          {active
            ? `${subscription?.plan.name ?? "Бизнес-тариф"} подключен к этой компании.`
            : "Для отделов, приглашений, company/department звонков и инструкций нужна активная бизнес-подписка компании."}
        </p>
      </div>
      {!active && (
        <button className="primary-button small" type="button" onClick={() => onNavigate("tariffs")}>
          <ShieldCheck size={16} />
          Выбрать бизнес-тариф
        </button>
      )}
    </div>
  );
}

function CreateCompanyForm({ onCreated }: { onCreated: (company: CompanyResponse) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Введите название компании.");
      return;
    }

    setBusy(true);
    try {
      const company = await api.createCompany(name.trim());
      await onCreated(company);
      setName("");
      setSuccess("Компания создана.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось создать компанию");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="create-company-form" onSubmit={submit}>
      <label>
        Название компании
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button className="primary-button" type="submit" disabled={busy}>
        <Plus size={18} />
        {busy ? "Создаю..." : "Создать компанию"}
      </button>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
    </form>
  );
}

function CompanyEmptyState({
  onCompanyCreated,
  compact = false
}: {
  onCompanyCreated: (company: CompanyResponse) => void | Promise<void>;
  compact?: boolean;
}) {
  return (
    <div className={`company-empty ${compact ? "compact" : ""}`}>
      <Building2 size={compact ? 28 : 38} />
      <div>
        <h2>Компании пока нет</h2>
        <p>
          Создать компанию можно без бизнес-подписки. Рабочие действия компании включаются
          только после активного бизнес-тарифа.
        </p>
      </div>
      <CreateCompanyForm onCreated={onCompanyCreated} />
    </div>
  );
}

function CompanyMiniCard({ company, manager }: { company: CompanyResponse; manager: boolean }) {
  return (
    <div className="company-mini-card">
      <div>
        <strong>{company.name}</strong>
        <small>{company.id}</small>
      </div>
      <span className={`status-chip ${manager ? "ok" : "warn"}`}>
        {manager ? "Менеджер" : "Участник"}
      </span>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TariffsPage({
  session,
  companies
}: {
  session: SessionState;
  companies: CompanyResponse[];
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companySubscriptions, setCompanySubscriptions] = useState<Record<string, Subscription>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        setLoading(true);
        setError("");
        const response = await api.listPlans();
        if (!cancelled) {
          setPlans([...response.plans].sort(comparePlans));
        }
      } catch (loadError) {
        if (!cancelled) {
          const endpointHint =
            loadError instanceof ApiError && loadError.status === 404
              ? " Endpoint GET /api/v1/plans пока недоступен."
              : "";
          setError(`Не удалось загрузить тарифы.${endpointHint}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const personalPlans = plans.filter((plan) => plan.type === "personal");
  const businessPlans = plans.filter((plan) => plan.type === "business");

  return (
    <section className="tariffs-layout">
      <div className="tariff-hero glass">
        <h1>Тарифы</h1>
        <p>Доступные планы загружаются из backend. Реальная оплата в MVP пока не подключена.</p>
      </div>
      {loading && <TariffSkeleton />}
      {!loading && error && <div className="form-error tariff-message">{error}</div>}
      {!loading && !error && plans.length === 0 && (
        <div className="empty-panel glass">Тарифы пока не настроены.</div>
      )}
      {!loading && !error && plans.length > 0 && (
        <>
          <PersonalSubscriptionPanel personalPlans={personalPlans} />
          <CompanySubscriptionPanel
            session={session}
            companies={companies}
            businessPlans={businessPlans}
            subscriptions={companySubscriptions}
            onSubscriptionChanged={(subscription) => {
              if (!subscription.company_uuid) return;
              setCompanySubscriptions((current) => ({
                ...current,
                [subscription.company_uuid as string]: subscription
              }));
            }}
          />
          <TariffSection title="Персональные тарифы" plans={personalPlans} />
          <TariffSection title="Бизнес-тарифы" plans={businessPlans} business />
        </>
      )}
    </section>
  );
}

function PersonalSubscriptionPanel({ personalPlans }: { personalPlans: Plan[] }) {
  const defaultPlanCode = personalPlans[0]?.code ?? "personal_plus";
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(defaultPlanCode);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedPlan(defaultPlanCode);
  }, [defaultPlanCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      try {
        setLoading(true);
        setError("");
        const response = await api.getSubscription();
        if (!cancelled) setSubscription(response);
      } catch (loadError) {
        if (cancelled) return;
        if (
          loadError instanceof ApiError &&
          (loadError.status === 404 || loadError.code === "subscription_not_found")
        ) {
          setSubscription(null);
        } else {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить подписку");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await api.activateSubscription(selectedPlan);
      setSubscription(response);
      setMessage("Персональная подписка активирована.");
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Не удалось активировать подписку");
    } finally {
      setBusy(false);
    }
  }

  const active = subscription?.status === "active";

  return (
    <section className="subscription-panel glass">
      <div className="panel-heading large">
        <div>
          <h2>Персональная подписка</h2>
          <p>Mock-активация личного тарифа через backend без платежной формы.</p>
        </div>
        <span className="status-chip warn">Mock</span>
      </div>
      <div className="subscription-company">
        <div>
          <strong>{subscription?.plan.name ?? "Личный тариф"}</strong>
          <small>
            {loading
              ? "Загружаю текущую подписку..."
              : active
                ? "Подписка привязана к вашему аккаунту."
                : "Можно активировать personal_start, personal_plus или personal_pro."}
          </small>
        </div>
        <SelectControl
          value={selectedPlan}
          onChange={(event) => setSelectedPlan(event.target.value as PlanCode)}
          disabled={busy || personalPlans.length === 0}
        >
          {personalPlans.length === 0 ? (
            <option value="personal_plus">Personal Plus</option>
          ) : (
            personalPlans.map((plan) => (
              <option key={plan.id} value={plan.code}>
                {plan.name}
              </option>
            ))
          )}
        </SelectControl>
        <span className={`status-chip ${active ? "ok" : "warn"}`}>
          {active ? "Активна" : subscription?.status === "canceled" ? "Отменена" : "Не активирована"}
        </span>
        <div className="subscription-actions">
          <button
            type="button"
            className="primary-button small"
            onClick={activate}
            disabled={busy || loading || personalPlans.length === 0}
          >
            <ShieldCheck size={16} />
            {busy ? "Сохраняю..." : active ? "Сменить тариф" : "Активировать подписку"}
          </button>
        </div>
      </div>
      {message && <div className="form-success tariff-message">{message}</div>}
      {error && <div className="form-error tariff-message">{error}</div>}
    </section>
  );
}

function CompanySubscriptionPanel({
  session,
  companies,
  businessPlans,
  subscriptions,
  onSubscriptionChanged
}: {
  session: SessionState;
  companies: CompanyResponse[];
  businessPlans: Plan[];
  subscriptions: Record<string, Subscription>;
  onSubscriptionChanged: (subscription: Subscription) => void;
}) {
  const managedCompanies = companies.filter((company) => company.manager_user_uuid === session.user.id);
  const defaultPlanCode = businessPlans[0]?.code ?? "business_start";
  const [selectedPlans, setSelectedPlans] = useState<Record<string, PlanCode>>({});
  const [busyCompanyId, setBusyCompanyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (managedCompanies.length === 0) {
    return null;
  }

  async function activate(companyId: string) {
    setBusyCompanyId(companyId);
    setMessage("");
    setError("");

    try {
      const subscription = await api.activateCompanySubscription(
        companyId,
        selectedPlans[companyId] ?? defaultPlanCode
      );
      onSubscriptionChanged(subscription);
      setMessage("Подписка активирована.");
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Не удалось активировать подписку");
    } finally {
      setBusyCompanyId("");
    }
  }

  async function cancel(companyId: string) {
    setBusyCompanyId(companyId);
    setMessage("");
    setError("");

    try {
      const subscription = await api.cancelCompanySubscription(companyId);
      onSubscriptionChanged(subscription);
      setMessage("Подписка отменена.");
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Не удалось отменить подписку");
    } finally {
      setBusyCompanyId("");
    }
  }

  return (
    <section className="subscription-panel glass">
      <div className="panel-heading large">
        <div>
          <h2>Бизнес-подписка компании</h2>
          <p>Временная mock-активация без оплаты и платежных форм.</p>
        </div>
        <span className="status-chip warn">Mock</span>
      </div>
      <div className="subscription-company-list">
        {managedCompanies.map((company) => {
          const subscription = subscriptions[company.id];
          const active = subscription?.status === "active";
          const selectedPlan = selectedPlans[company.id] ?? defaultPlanCode;

          return (
            <div className="subscription-company" key={company.id}>
              <div>
                <strong>{company.name}</strong>
                <small>{company.id}</small>
              </div>
              <SelectControl
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlans((current) => ({
                    ...current,
                    [company.id]: event.target.value as PlanCode
                  }))
                }
                disabled={busyCompanyId === company.id || businessPlans.length === 0}
              >
                {businessPlans.length === 0 ? (
                  <option value="business_start">Business Start</option>
                ) : (
                  businessPlans.map((plan) => (
                    <option key={plan.id} value={plan.code}>
                      {plan.name}
                    </option>
                  ))
                )}
              </SelectControl>
              <span className={`status-chip ${active ? "ok" : "warn"}`}>
                {active ? "Активна" : subscription?.status === "canceled" ? "Отменена" : "Не активирована"}
              </span>
              <div className="subscription-actions">
                <button
                  type="button"
                  className="primary-button small"
                  onClick={() => activate(company.id)}
                  disabled={busyCompanyId === company.id}
                >
                  <ShieldCheck size={16} />
                  {busyCompanyId === company.id ? "Сохраняю..." : "Активировать подписку"}
                </button>
                {active && (
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => cancel(company.id)}
                    disabled={busyCompanyId === company.id}
                  >
                    <X size={16} />
                    Отменить подписку
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {message && <div className="form-success tariff-message">{message}</div>}
      {error && <div className="form-error tariff-message">{error}</div>}
    </section>
  );
}

function comparePlans(left: Plan, right: Plan) {
  const leftIndex = planOrder.indexOf(left.code);
  const rightIndex = planOrder.indexOf(right.code);
  return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
    (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
}

function TariffSection({
  title,
  plans,
  business
}: {
  title: string;
  plans: Plan[];
  business?: boolean;
}) {
  if (plans.length === 0) {
    return (
      <section className="tariff-section">
        <h2>{title}</h2>
        <div className="empty-panel glass">Тарифы пока не настроены.</div>
      </section>
    );
  }

  return (
    <section className="tariff-section">
      <h2>{title}</h2>
      <div className="tariff-grid">
        {plans.map((plan) => (
          <TariffCard key={plan.id} plan={plan} business={business} />
        ))}
      </div>
    </section>
  );
}

function TariffCard({ plan, business }: { plan: Plan; business?: boolean }) {
  const cardStyle = {
    "--tariff-card-gradient": planGradients[plan.code]
  } as CSSProperties;
  const activeInstructionLimit =
    business ? plan.instructions_per_department_limit ?? plan.active_instruction_limit : plan.active_instruction_limit;
  const features = [
    `Минут в месяц: ${formatMinutesLimit(plan.monthly_minutes_limit)}`,
    `Активных инструкций: ${formatInstructionLimit(activeInstructionLimit)}`,
    business ? `Компаний: ${formatNullableLimit(plan.company_limit)}` : "",
    business ? `Отделов на компанию: ${formatNullableLimit(plan.departments_per_company_limit)}` : "",
    business ? `Сотрудников на компанию: ${formatNullableLimit(plan.members_per_company_limit)}` : "",
    `Уровень анализа: ${analysisLevelLabel(plan.analysis_level)}`,
    `Хранение истории: ${formatHistoryDays(plan.history_retention_days)}`,
    `Экспорт отчетов: ${availabilityLabel(plan.export_enabled)}`,
    business ? `Командная аналитика: ${availabilityLabel(plan.team_analytics_enabled)}` : "",
    business ? `Доступ к API: ${availabilityLabel(plan.api_access_enabled)}` : ""
  ].filter(Boolean);

  return (
    <article className="tariff-card glass" style={cardStyle} data-reveal-item>
      <div className="tariff-card-head">
        <span className="status-chip warn">{plan.type === "personal" ? "Персональный" : "Бизнес"}</span>
        <h3>{plan.name}</h3>
      </div>
      <ul className="tariff-feature-list">
        {features.map((feature) => (
          <li key={feature}>
            <Check size={16} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button className="ghost-button wide" disabled>
        Скоро
      </button>
    </article>
  );
}

function TariffSkeleton() {
  return (
    <>
      <section className="tariff-section">
        <h2>Персональные тарифы</h2>
        <div className="tariff-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="tariff-card glass skeleton-card" key={index}>
              <SkeletonLine className="button" />
              <SkeletonLine className="title" />
              <TextBlockSkeleton rows={5} />
              <SkeletonLine className="button" />
            </div>
          ))}
        </div>
      </section>
      <section className="tariff-section">
        <h2>Бизнес-тарифы</h2>
        <div className="tariff-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="tariff-card glass skeleton-card" key={index}>
              <SkeletonLine className="button" />
              <SkeletonLine className="title" />
              <TextBlockSkeleton rows={7} />
              <SkeletonLine className="button" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function formatMinutesLimit(value: number) {
  return `${value} минут`;
}

function formatInstructionLimit(value: number) {
  return `${value}`;
}

function formatHistoryDays(value: number) {
  return `${value} ${pluralizeRu(value, "день", "дня", "дней")}`;
}

function formatNullableLimit(value: number | null) {
  return value === null ? "Не применяется" : String(value);
}

function availabilityLabel(value: boolean) {
  return value ? "Доступно" : "Недоступно";
}

function analysisLevelLabel(value: string) {
  return analysisLevelLabels[value] ?? (value || "Не указано");
}

function pluralizeRu(value: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(value) % 100;
  const last = Math.abs(value) % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function ProductPreview({ compact }: { compact: boolean }) {
  return (
    <div className={`product-preview ${compact ? "compact" : ""}`} data-reveal-item>
      <div className="preview-title">Последний звонок</div>
      <div className="preview-overview">
        <div className="preview-selected-call">
          <span className="play-large">
            <Play size={22} fill="currentColor" />
          </span>
          <div>
            <span>Выбранный звонок</span>
            <strong>Обсуждение условий.mp3</strong>
            <small>21 мая 2025 · 18:47 · Отдел продаж</small>
          </div>
          <span className="status-chip ok">Анализ готов</span>
        </div>
        <div className="preview-timeline">
          {normalTimelineSteps.map((step) => (
            <div className={`preview-timeline-step ${step === "analyzed" ? "current" : "done"}`} key={step}>
              <span>
                {step === "new" && <CloudUpload size={15} />}
                {step === "processing" && <RefreshCw size={15} />}
                {step === "transcribed" && <FileText size={15} />}
                {step === "analyzed" && <Check size={15} />}
              </span>
              <strong>{statusMeta[step].label}</strong>
              <small>{step === "analyzed" ? "сейчас" : "готово"}</small>
            </div>
          ))}
        </div>
        <div className="preview-grid">
          <div>
            <div className="preview-card-title">
              <h3>Расшифровка</h3>
              <span className="status-chip ok">Готово</span>
            </div>
            <div className="preview-transcript">
              <p><strong>Спикер 1</strong> Нужно согласовать условия поставки и интеграцию.</p>
              <p><strong>Спикер 2</strong> Срок поставки 3-5 рабочих дней, API доступен.</p>
            </div>
          </div>
          <div>
            <div className="preview-card-title">
              <h3>AI-анализ</h3>
              <span className="status-chip ok">Анализ готов</span>
            </div>
            <div className="preview-analysis">
              <p><Check size={15} /> Общая оценка разговора: хорошо</p>
              <p><CircleAlert size={15} /> Риск: клиент ждет точный расчет</p>
              <p><ChevronRight size={15} /> Следующий шаг: отправить КП</p>
            </div>
          </div>
        </div>
        <div className="preview-next-step">
          <span>
            <WandSparkles size={17} />
          </span>
          <div>
            <strong>Следующий шаг</strong>
            <small>Подготовить коммерческое предложение по двум тарифам.</small>
          </div>
          <button className="ghost-button dark" type="button">Открыть</button>
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="workflow-step" data-reveal-item>
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function SecurityItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="security-item" data-reveal-item>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function LandingTariffPreview() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        setLoading(true);
        setError("");
        const response = await api.listPlans();
        if (!cancelled) {
          setPlans([...response.plans].sort(comparePlans));
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить тарифы.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const personalPlans = plans.filter((plan) => plan.type === "personal");
  const businessPlans = plans.filter((plan) => plan.type === "business");

  if (loading) {
    return <TariffSkeleton />;
  }

  if (error) {
    return <div className="form-error tariff-message">{error}</div>;
  }

  if (plans.length === 0) {
    return <div className="empty-panel glass">Тарифы пока не настроены.</div>;
  }

  return (
    <>
      <TariffSection title="Персональные тарифы" plans={personalPlans} />
      <TariffSection title="Бизнес-тарифы" plans={businessPlans} business />
    </>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="benefit" data-reveal-item>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="metric glass">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricSkeleton({ title }: { title: string }) {
  return (
    <div className="metric glass">
      <span>{title}</span>
      <span className="skeleton-line skeleton-metric-value" />
    </div>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={`skeleton-line ${className}`} />;
}

function TextBlockSkeleton({ rows }: { rows: number }) {
  return (
    <div className="text-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonLine key={index} className={index === rows - 1 ? "short" : ""} />
      ))}
    </div>
  );
}

function CallListSkeleton({ compact, count }: { compact?: boolean; count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className={`call-row skeleton-row ${compact ? "compact" : ""}`} key={index}>
          <span className="skeleton-circle" />
          <span className="skeleton-row-copy">
            <SkeletonLine />
            <SkeletonLine className="short" />
          </span>
          {!compact && <span className="skeleton-pill" />}
          {!compact && <span className="skeleton-dot" />}
        </div>
      ))}
    </>
  );
}

function CallDetailSkeleton() {
  return (
    <>
      <div className="panel-heading large">
        <SkeletonLine className="title" />
        <SkeletonLine className="button" />
      </div>
      <div className="selected-call-card skeleton-card">
        <span className="skeleton-circle large" />
        <span className="skeleton-row-copy">
          <SkeletonLine className="short" />
          <SkeletonLine className="title" />
          <SkeletonLine />
        </span>
        <span className="skeleton-pill" />
        <span className="skeleton-dot" />
      </div>
      <div className="status-timeline skeleton-timeline">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="timeline-step" key={index}>
            <span className="skeleton-circle" />
            <SkeletonLine className="short" />
            <SkeletonLine className="tiny" />
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <InfoCardSkeleton />
        <InfoCardSkeleton />
      </div>
    </>
  );
}

function InfoCardSkeleton() {
  return (
    <div className="info-card">
      <div className="card-title">
        <SkeletonLine className="title" />
        <span className="skeleton-pill" />
      </div>
      <TextBlockSkeleton rows={5} />
      <SkeletonLine className="button" />
    </div>
  );
}

function AnalysisResultSkeleton() {
  return (
    <div className="analysis-user-summary">
      <TextBlockSkeleton rows={5} />
      <div className="topic-list skeleton-topic-list">
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
      </div>
      <TextBlockSkeleton rows={2} />
    </div>
  );
}

function InstructionListSkeleton({ count }: { count: number }) {
  return (
    <div className="instruction-mini-list">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-circle small" />
          <span className="skeleton-row-copy">
            <SkeletonLine />
            <SkeletonLine className="short" />
          </span>
          <span className="skeleton-pill" />
        </div>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: CallStatus }) {
  const className = status === "failed" ? "bad" : status === "processing" ? "warn" : "ok";
  return <span className={`status-chip ${className}`}>{statusMeta[status].chip}</span>;
}

function StatusTimeline({
  current,
  statuses
}: {
  current: CallStatus;
  statuses?: CallStatus[];
}) {
  const steps = statuses?.length ? statuses : timelineFromStatus(current);
  const currentIndex = steps.indexOf(current);

  return (
    <div
      className="status-timeline"
      style={{ "--timeline-steps": steps.length } as React.CSSProperties}
    >
      {steps.map((step, index) => (
        <div
          className={`timeline-step ${index < currentIndex ? "done" : ""} ${
            current === step ? "current" : ""
          } ${step === "failed" ? "danger" : ""}`}
          key={step}
        >
          <span>
            {step === "new" && <CloudUpload size={19} />}
            {step === "processing" && <RefreshCw size={19} />}
            {step === "transcribed" && <FileText size={19} />}
            {step === "analyzed" && <Check size={19} />}
            {step === "failed" && <X size={19} />}
          </span>
          <strong>{statusMeta[step].label}</strong>
          <small>{step === current ? "сейчас" : index < currentIndex ? "готово" : "—"}</small>
        </div>
      ))}
    </div>
  );
}

function InfoCard({
  title,
  status,
  action,
  children,
  onAction
}: {
  title: string;
  status: string;
  action: string;
  children: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="info-card">
      <div className="card-title">
        <h3>{title}</h3>
        <span className="status-chip ok">{status}</span>
      </div>
      {children}
      <button className="text-link" type="button" onClick={onAction}>
        {action}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function TranscriptPreview({
  transcription,
  expanded,
  loading
}: {
  transcription?: TranscriptionResponse;
  expanded: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <TextBlockSkeleton rows={4} />;
  }

  const segments = transcriptionSegments(transcription);

  if (segments.length > 0) {
    return (
      <div className={`transcript-preview segmented expandable-content ${expanded ? "expanded" : "collapsed"}`}>
        {segments.map((segment, index) => (
          <div className="transcript-segment" key={`${segment.start_seconds ?? index}-${segment.text}`}>
            <div className="segment-meta">
              <span>{formatSegmentTimeRange(segment.start_seconds, segment.end_seconds)}</span>
              <strong>{speakerLabel(segment.speaker)}</strong>
            </div>
            <p>{segment.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (!transcription?.text) {
    return <p className="muted">Расшифровка появится после обработки звонка.</p>;
  }

  return (
    <div className={`transcript-preview fallback expandable-content ${expanded ? "expanded" : "collapsed"}`}>
      {transcription.text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
    </div>
  );
}

function AnalysisPreview({
  analysis,
  expanded,
  loading
}: {
  analysis?: AnalysisResponse;
  expanded: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <TextBlockSkeleton rows={4} />;
  }

  if (!analysis) {
    return <p className="muted">Запустите анализ после готовой расшифровки.</p>;
  }

  return (
    <div className={`analysis-preview expandable-content ${expanded ? "expanded" : "collapsed"}`}>
      <AnalysisStructuredView analysis={analysis} />
    </div>
  );
}

function AnalysisStructuredView({ analysis }: { analysis?: AnalysisResponse }) {
  if (!analysis) {
    return <p className="muted">Запустите анализ после готовой расшифровки.</p>;
  }

  const details = analysisDetails(analysis);

  return (
    <div className="analysis-structured">
      <AnalysisSection title="Резюме">
        <p>{details.summary}</p>
      </AnalysisSection>

      <AnalysisSection title="Ключевые темы">
        <div className="topic-list">
          {details.topics.length > 0 ? (
            details.topics.map((topic) => <span key={topic}>{topic}</span>)
          ) : (
            <span>Темы не указаны</span>
          )}
        </div>
      </AnalysisSection>

      <AnalysisSection title="Тон диалога">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue label="Общий тон" value={details.dialogueTone.overall} />
          <AnalysisKeyValue label="Менеджер" value={details.dialogueTone.manager} />
          <AnalysisKeyValue label="Клиент" value={details.dialogueTone.client} />
        </div>
        <EvidenceQuotes quotes={details.dialogueTone.evidenceQuotes} />
      </AnalysisSection>

      <AnalysisSection title="Вопросы клиента и ответы менеджера">
        <AnalysisQuestionList questions={details.clientQuestions} />
      </AnalysisSection>

      <AnalysisSection title="Полнота ответов менеджера">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue
            label="Статус"
            value={enumLabel(details.questionCoverage.status, coverageStatusLabels)}
          />
          <AnalysisKeyValue label="Итог" value={details.questionCoverage.summary} />
        </div>
        <AnalysisStringList
          items={details.questionCoverage.unansweredQuestions}
          emptyLabel="Незакрытые вопросы не указаны"
        />
      </AnalysisSection>

      <AnalysisSection title="Качество менеджера">
        <div className="analysis-columns">
          <div>
            <strong>Сильные стороны</strong>
            <AnalysisStringList items={details.managerQuality.strengths} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Проблемы</strong>
            <AnalysisStringList items={details.managerQuality.issues} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Рекомендации</strong>
            <AnalysisStringList items={details.managerQuality.recommendations} emptyLabel="Не указаны" />
          </div>
        </div>
      </AnalysisSection>

      <AnalysisSection title="Итог, риски и следующие шаги">
        <div className="analysis-kv-grid">
          <AnalysisKeyValue label="Итог звонка" value={details.callOutcome} />
          <AnalysisKeyValue label="Уверенность" value={enumLabel(details.confidence, confidenceLabels)} />
        </div>
        <div className="analysis-columns">
          <div>
            <strong>Возражения клиента</strong>
            <AnalysisStringList items={details.customerObjections} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Риски</strong>
            <AnalysisStringList items={details.risks} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Следующие шаги</strong>
            <AnalysisStringList items={details.nextSteps} emptyLabel="Не указаны" />
          </div>
        </div>
      </AnalysisSection>
    </div>
  );
}

function AnalysisSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="analysis-section">
      <strong>{title}</strong>
      {children}
    </section>
  );
}

function AnalysisKeyValue({ label, value }: { label: string; value?: string }) {
  return (
    <div className="analysis-kv">
      <span>{label}</span>
      <p>{value && value.trim() ? value : "Не указано"}</p>
    </div>
  );
}

function AnalysisStringList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="analysis-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="analysis-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function EvidenceQuotes({ quotes }: { quotes: string[] }) {
  if (quotes.length === 0) return null;

  return (
    <div className="evidence-quotes">
      <span>Цитаты</span>
      {quotes.map((quote, index) => (
        <blockquote key={`${quote}-${index}`}>{quote}</blockquote>
      ))}
    </div>
  );
}

function AnalysisQuestionList({ questions }: { questions: AnalysisQuestion[] }) {
  if (questions.length === 0) {
    return <p className="analysis-empty">Вопросы клиента не указаны.</p>;
  }

  return (
    <div className="analysis-question-list">
      {questions.map((question, index) => (
        <div className="analysis-question" key={`${question.question ?? "question"}-${index}`}>
          <div className="analysis-question-heading">
            <strong>{question.question || "Вопрос не указан"}</strong>
            <span>{enumLabel(question.answerStatus, answerStatusLabels) || "Статус не указан"}</span>
          </div>
          <p>
            <b>Ответ менеджера:</b> {question.managerAnswer || "Не указан"}
          </p>
          <EvidenceQuotes quotes={question.evidenceQuotes} />
        </div>
      ))}
    </div>
  );
}

function FileDropZone({
  file,
  icon,
  accept,
  buttonLabel,
  emptyLabel,
  onFile
}: {
  file: File | null;
  icon: React.ReactNode;
  accept: string;
  buttonLabel: string;
  emptyLabel: string;
  onFile: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      onFile(droppedFile);
    }
  }

  return (
    <label
      className={`file-dropzone ${dragActive ? "dragging" : ""}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <span className="file-dropzone-icon">{icon}</span>
      <span className="file-dropzone-copy">
        <strong>{file?.name ?? emptyLabel}</strong>
        <small>{file ? "Файл готов к загрузке" : "Можно выбрать через проводник или перетащить файл"}</small>
      </span>
      <span className="ghost-button file-dropzone-button">{buttonLabel}</span>
    </label>
  );
}

function InstructionChoiceList({
  instructions,
  selectedInstructionIds,
  companies,
  departments,
  loading,
  onToggle
}: {
  instructions: AnalysisInstruction[];
  selectedInstructionIds: string[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading?: boolean;
  onToggle: (instructionId: string) => void;
}) {
  if (loading) {
    return <InstructionListSkeleton count={3} />;
  }

  if (instructions.length === 0) {
    return (
      <div className="instruction-mini-list empty">
        <FileText size={18} />
        <span>Инструкций для выбранного контекста пока нет.</span>
      </div>
    );
  }

  return (
    <div className="instruction-choice-list">
      {instructions.map((instruction) => {
        const selected = selectedInstructionIds.includes(instruction.id);

        return (
          <button
            key={instruction.id}
            type="button"
            className={`instruction-choice ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onToggle(instruction.id)}
          >
            <span className="choice-check">{selected && <Check size={15} />}</span>
            <span>
              <strong>{instruction.title}</strong>
              <small>{instructionContextLabel(instruction, companies, departments)} · {instruction.original_filename}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function InstructionMiniList({
  instructions,
  companies,
  departments,
  title,
  emptyText
}: {
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  title?: string;
  emptyText?: string;
}) {
  if (instructions.length === 0) {
    return (
      <div className="instruction-mini-list empty">
        <FileText size={18} />
        <span>{emptyText ?? "Инструкций пока нет."}</span>
      </div>
    );
  }

  return (
    <div className="instruction-mini-list">
      {title && <strong className="instruction-mini-title">{title}</strong>}
      {instructions.map((instruction) => (
        <div key={instruction.id}>
          <FileText size={18} />
          <span>
            <strong>{instruction.title}</strong>
            <small>{instructionContextLabel(instruction, companies, departments)}</small>
          </span>
          <span className="status-chip ok">Активна</span>
        </div>
      ))}
    </div>
  );
}

function StepItem({
  number,
  title,
  text,
  active,
  done
}: {
  number?: string;
  title: string;
  text: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className={`step-item ${active ? "active" : ""} ${done ? "done" : ""}`}>
      <span>{done ? <Check size={17} /> : number}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function availableInstructionsForContext(
  instructions: AnalysisInstruction[],
  scope: VisibilityScope,
  companyId: string,
  departmentId: string
) {
  if (scope === "department") {
    return instructions.filter(
      (item) =>
        (item.scope === "company" && item.company_uuid === companyId) ||
        (item.scope === "department" && item.department_uuid === departmentId)
    );
  }

  if (scope === "company") {
    return instructions.filter((item) => item.scope === "company" && item.company_uuid === companyId);
  }

  return instructions.filter((item) => item.scope === "personal");
}

function availableInstructionsForCall(instructions: AnalysisInstruction[], call: CallResponse) {
  return availableInstructionsForContext(
    instructions,
    call.visibility_scope,
    call.company_uuid ?? "",
    call.department_uuid ?? ""
  );
}

function instructionContextHint(scope: VisibilityScope) {
  if (scope === "personal") {
    return "Личный звонок будет анализироваться только по личным инструкциям.";
  }

  if (scope === "company") {
    return "Звонок компании будет анализироваться по инструкциям выбранной компании.";
  }

  return "Звонок отдела будет анализироваться по инструкциям компании и выбранного отдела.";
}

function contextInstructionCaption(call?: CallResponse) {
  if (!call) return "Контекст";
  if (call.visibility_scope === "personal") return "Личные";
  if (call.visibility_scope === "company") return "Компания";
  return "Компания + отдел";
}

function instructionContextLabel(
  instruction: AnalysisInstruction,
  companies: CompanyResponse[],
  departments: DepartmentResponse[]
) {
  if (instruction.scope === "personal") return "Лично";

  const company = companies.find((item) => item.id === instruction.company_uuid)?.name ?? "Компания";
  if (instruction.scope === "company") return `Компания · ${company}`;

  const department =
    departments.find((item) => item.id === instruction.department_uuid)?.name ?? "Отдел";
  return `Отдел · ${company} · ${department}`;
}

function invitationRoleLabel(invitation: Invitation) {
  if (invitation.department_role === "department_leader") return "Руководитель отдела";
  return "Сотрудник";
}

function transcriptionSegments(transcription?: TranscriptionResponse) {
  const segments = transcription?.segments;
  if (!Array.isArray(segments)) return [];

  return segments.filter((segment) => segment.text.trim().length > 0);
}

function speakerLabel(speaker: string) {
  const trimmed = speaker.trim();
  if (!trimmed) return "Спикер не указан";

  const match = /^speaker_(\d+)$/i.exec(trimmed);
  if (!match) return trimmed;

  return `Спикер ${Number(match[1]) + 1}`;
}

function formatSegmentTimeRange(start?: number | null, end?: number | null) {
  const formattedStart = formatTimestamp(start);
  const formattedEnd = formatTimestamp(end);

  if (formattedStart && formattedEnd) return `${formattedStart} - ${formattedEnd}`;
  if (formattedStart) return formattedStart;
  if (formattedEnd) return formattedEnd;
  return "Таймкод не указан";
}

function formatTimestamp(seconds?: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "";

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");

  if (hours > 0) return `${hours}:${minutes}:${rest}`;
  return `${minutes}:${rest}`;
}

function analysisRecord(analysis?: AnalysisResponse) {
  const result = analysis?.result_json;
  if (!isPlainRecord(result)) {
    return {};
  }

  return result;
}

function analysisSummary(analysis?: AnalysisResponse) {
  const record = analysisRecord(analysis);
  const summary = stringValue(record.summary);
  if (summary) return summary;
  return analysis?.result_text ?? "Анализ появится здесь после обработки звонка.";
}

function analysisTopics(analysis?: AnalysisResponse) {
  return stringList(analysisRecord(analysis).topics);
}

function analysisNextStep(analysis?: AnalysisResponse) {
  const record = analysisRecord(analysis);
  const nextStep = stringValue(record.next_step);
  if (nextStep) return nextStep;

  const nextSteps = stringList(record.next_steps);
  if (nextSteps.length > 0) return nextSteps[0];

  return "После анализа здесь появится рекомендуемое действие.";
}

function analysisDetails(analysis?: AnalysisResponse): AnalysisDetails {
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

function questionList(value: unknown): AnalysisQuestion[] {
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

function recordField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isPlainRecord(value) ? value : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stringList(value: unknown) {
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

function enumLabel(value: string | undefined, labels: Record<string, string>) {
  if (!value) return undefined;
  return labels[value] ?? value;
}

export default App;
