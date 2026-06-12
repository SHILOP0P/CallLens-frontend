import {
  Bell,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  CloudUpload,
  FileAudio,
  FileText,
  Headphones,
  LockKeyhole,
  LogOut,
  Mic2,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UsersRound,
  WandSparkles,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import type {
  AnalysisInstruction,
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  InstructionScope,
  SessionState,
  TranscriptionResponse,
  VisibilityScope
} from "./types";

const SESSION_KEY = "calllens.session.v1";

const pageRoutes: Record<AppPage, string> = {
  overview: "/app/overview",
  calls: "/app/calls",
  upload: "/app/upload",
  analysis: "/app/analysis",
  instructions: "/app/instructions",
  tariffs: "/app/tariffs"
};

const navItems: Array<{ page: AppPage; label: string }> = [
  { page: "overview", label: "Обзор" },
  { page: "calls", label: "Звонки" },
  { page: "analysis", label: "AI-анализ" },
  { page: "instructions", label: "Инструкции" },
  { page: "tariffs", label: "Тарифы" }
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

function isAnalysisDone(analysis?: AnalysisResponse) {
  return analysis?.status === "done";
}

function App() {
  const [session, setSession] = useState<SessionState | null>(() => readStoredSession());
  const [showPublicLanding, setShowPublicLanding] = useState(() => !session);
  const [workspaceReady, setWorkspaceReady] = useState(() => !session);
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname));
  const [calls, setCalls] = useState<CallResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [instructions, setInstructions] = useState<AnalysisInstruction[]>([]);
  const [transcriptions, setTranscriptions] = useState<Record<string, TranscriptionResponse>>({});
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResponse>>({});
  const [selectedCallId, setSelectedCallId] = useState<string>("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

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
      if (!session) {
        clearWorkspaceState();
        setWorkspaceReady(true);
        return;
      }

      setWorkspaceReady(false);
      setLoadingWorkspace(true);

      try {
        const [loadedCalls, loadedCompanies] = await Promise.all([
          api.listCalls(session.accessToken),
          api.listCompanies(session.accessToken)
        ]);

        if (cancelled) return;

        const loadedDepartments = (
          await Promise.all(
            loadedCompanies.map((company) =>
              api.listDepartments(session.accessToken, company.id).catch(() => [])
            )
          )
        ).flat();

        const loadedInstructions = (
          await Promise.all([
            api.listInstructions(session.accessToken, "personal").catch(() => []),
            ...loadedCompanies.map((company) =>
              api.listInstructions(session.accessToken, "company", company.id).catch(() => [])
            ),
            ...loadedDepartments.map((department) =>
              api
                .listInstructions(session.accessToken, "department", department.company_uuid, department.id)
                .catch(() => [])
            )
          ])
        ).flat();

        if (cancelled) return;

        setCalls(loadedCalls);
        setCompanies(loadedCompanies);
        setDepartments(loadedDepartments);
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
  }, [session]);

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) ?? calls[0],
    [calls, selectedCallId]
  );

  useEffect(() => {
    if (!session || !selectedCall) return;

    const callId = selectedCall.id;
    api
      .getTranscription(session.accessToken, callId)
      .then((transcription) =>
        setTranscriptions((current) => ({
          ...current,
          [callId]: transcription
        }))
      )
      .catch(() => undefined);

    api
      .getAnalysis(session.accessToken, callId)
      .then((analysis) =>
        setAnalyses((current) => ({
          ...current,
          [callId]: analysis
        }))
      )
      .catch(() => undefined);
  }, [selectedCall?.id, session]);

  function navigate(nextPage: AppPage) {
    setShowPublicLanding(false);
    setPage(nextPage);
    window.history.pushState({}, "", pageRoutes[nextPage]);
  }

  function applySession(nextSession: SessionState) {
    persistSession(nextSession);
    setSession(nextSession);
    setWorkspaceReady(false);
    navigate("overview");
  }

  async function logout() {
    if (session) {
      await api.logout(session.accessToken).catch(() => undefined);
    }
    persistSession(null);
    setSession(null);
    clearWorkspaceState();
    setWorkspaceReady(true);
    setShowPublicLanding(true);
    window.history.pushState({}, "", "/");
    setPage("calls");
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
    setInstructions([]);
    setTranscriptions({});
    setAnalyses({});
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

  if (!session || showPublicLanding) {
    return (
      <Landing
        session={session}
        onAuth={applySession}
        onGetStarted={getStarted}
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
      onNavigate={navigate}
      onOpenLanding={openLanding}
      onLogout={logout}
    >
      {page === "overview" && (
        <OverviewPage
          calls={calls}
          companies={companies}
          departments={departments}
          loading={loadingWorkspace}
          selectedCall={selectedCall}
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
          transcription={selectedCall ? transcriptions[selectedCall.id] : undefined}
          analysis={selectedCall ? analyses[selectedCall.id] : undefined}
          onSelectCall={setSelectedCallId}
          onNavigate={navigate}
          loading={loadingWorkspace}
        />
      )}

      {page === "upload" && (
        <UploadPage
          session={session}
          companies={companies}
          departments={departments}
          instructions={instructions}
          onNavigate={navigate}
          onUploaded={(call) => {
            setCalls((current) => [call, ...current]);
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
          analyses={analyses}
          instructions={instructions}
          companies={companies}
          departments={departments}
          onSelectCall={setSelectedCallId}
          onAnalysisReady={(callId, analysis) =>
            setAnalyses((current) => ({
              ...current,
              [callId]: analysis
            }))
          }
          onNavigate={navigate}
        />
      )}

      {page === "instructions" && (
        <InstructionsPage
          session={session}
          instructions={instructions}
          companies={companies}
          departments={departments}
          onInstructionCreated={(instruction) =>
            setInstructions((current) => [instruction, ...current])
          }
        />
      )}

      {page === "tariffs" && <TariffsPage />}
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

function Landing({
  session,
  onAuth,
  onGetStarted
}: {
  session: SessionState | null;
  onAuth: (session: SessionState) => void;
  onGetStarted: () => void;
}) {
  const [showAuth, setShowAuth] = useState<"login" | "register" | null>(null);

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
          <button className="ghost-button dark" onClick={session ? onGetStarted : () => setShowAuth("login")}>
            {session ? "В кабинет" : "Войти"}
          </button>
          <button className="primary-button" onClick={handleStart}>
            Приступить к работе
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
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

      <section className="benefits" id="features">
        <h2>Почему команды выбирают CallLens</h2>
        <div className="benefit-grid">
          <Benefit icon={<Clock3 />} title="Экономия времени" text="Автоматическая расшифровка и анализ." />
          <Benefit icon={<Star />} title="Больше побед" text="Выявляйте сильные и слабые стороны." />
          <Benefit icon={<ShieldCheck />} title="Прозрачность процессов" text="Контроль качества на всех этапах." />
          <Benefit icon={<UsersRound />} title="Управление и контроль" text="Команды, отделы и роли доступа." />
        </div>
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
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
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
  children,
  onNavigate,
  onOpenLanding,
  onLogout
}: {
  activePage: AppPage;
  session: SessionState;
  children: React.ReactNode;
  onNavigate: (page: AppPage) => void;
  onOpenLanding: () => void;
  onLogout: () => void;
}) {
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
          <button className="icon-button" aria-label="Уведомления">
            <Bell size={19} />
          </button>
          <div className="avatar">{session.user.full_name[0] ?? "C"}</div>
          <div>
            <strong>
              {session.user.full_name} {session.user.full_surname}
            </strong>
            <span>{session.user.post ?? "Пользователь"}</span>
          </div>
          <button className="icon-button" aria-label="Меню профиля">
            <ChevronDown size={18} />
          </button>
          <button className="icon-button logout" onClick={onLogout} aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="workspace">{children}</main>
    </div>
  );
}

function OverviewPage({
  calls,
  companies,
  departments,
  selectedCall,
  transcription,
  analysis,
  loading,
  onNavigate
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  loading: boolean;
  onNavigate: (page: AppPage) => void;
}) {
  const analyzedCount = calls.filter((call) => call.status === "analyzed").length;

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
        <Metric title="Всего звонков" value={loading ? "..." : calls.length.toString()} />
        <Metric title="Проанализировано" value={analyzedCount.toString()} />
        <Metric title="Компании" value={companies.length.toString()} />
        <Metric title="Отделы" value={departments.length.toString()} />
      </div>
      <div className="overview-preview glass">
        <CallDetailPanel
          call={selectedCall}
          companies={companies}
          departments={departments}
          transcription={transcription}
          analysis={analysis}
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
  transcription,
  analysis,
  loading,
  onSelectCall,
  onNavigate
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  loading: boolean;
  onSelectCall: (callId: string) => void;
  onNavigate: (page: AppPage) => void;
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
          {loading && <div className="empty-state">Загружаю звонки...</div>}
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
          onNavigate={onNavigate}
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
  onNavigate
}: {
  call?: CallResponse;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  onNavigate: (page: AppPage) => void;
}) {
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

  return (
    <>
      <div className="panel-heading large">
        <h2>Обзор звонка</h2>
        <button className="primary-button small" onClick={() => onNavigate("upload")}>
          <CloudUpload size={16} />
          Загрузить звонок
        </button>
      </div>
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
        <MoreVertical size={19} />
      </div>
      <StatusTimeline current={call.status} />
      <div className="detail-grid">
        <InfoCard
          title="Расшифровка"
          status={transcription?.status === "transcribed" ? "Готово" : "Ожидает"}
          action="Открыть полную расшифровку"
        >
          <TranscriptPreview transcription={transcription} />
        </InfoCard>
        <InfoCard
          title="AI-анализ"
          status={isAnalysisDone(analysis) ? "Анализ готов" : "Ожидает"}
          action="Посмотреть анализ"
          onAction={() => onNavigate("analysis")}
        >
          <AnalysisPreview analysis={analysis} />
        </InfoCard>
      </div>
      <div className="next-step">
        <span className="step-icon">
          <WandSparkles size={19} />
        </span>
        <div>
          <h3>Следующий шаг</h3>
          <p>{analysis?.result_text ?? "После анализа здесь появится рекомендация по звонку."}</p>
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
  onNavigate,
  onUploaded
}: {
  session: SessionState;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  instructions: AnalysisInstruction[];
  onNavigate: (page: AppPage) => void;
  onUploaded: (call: CallResponse) => void;
}) {
  const [title, setTitle] = useState("Обсуждение условий договора с клиентом");
  const [audio, setAudio] = useState<File | null>(null);
  const [scope, setScope] = useState<VisibilityScope>("department");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(
    departments.find((department) => department.company_uuid === companies[0]?.id)?.id ?? ""
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const availableDepartments = departments.filter((department) => department.company_uuid === companyId);
  const availableInstructions = availableInstructionsForContext(
    instructions,
    scope,
    companyId,
    departmentId
  );

  useEffect(() => {
    if (!companyId && companies[0]) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  useEffect(() => {
    if (scope === "department" && !departmentId && availableDepartments[0]) {
      setDepartmentId(availableDepartments[0].id);
    }
  }, [availableDepartments, departmentId, scope]);

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
      const created = await api.createCall(session.accessToken, payload);
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
        <label>
          Аудиофайл
          <div className="file-picker">
            <FileAudio size={24} />
            <label className="ghost-button file-button">
              Выбрать аудиофайл
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,audio/*"
                onChange={(event) => setAudio(event.target.files?.[0] ?? null)}
              />
            </label>
            <span>{audio ? audio.name : "Файл не выбран"}</span>
          </div>
          <small>Поддерживаются: MP3, WAV, M4A, OGG. Максимальный размер: 100 МБ.</small>
        </label>
        <div>
          <span className="field-title">Куда добавить звонок?</span>
          <div className="segmented scope">
            <button
              type="button"
              className={scope === "personal" ? "active" : ""}
              onClick={() => setScope("personal")}
            >
              <CircleUserRound size={17} />
              Лично мне
            </button>
            <button
              type="button"
              className={scope === "company" ? "active" : ""}
              onClick={() => setScope("company")}
            >
              <BriefcaseBusiness size={17} />
              В компанию
            </button>
            <button
              type="button"
              className={scope === "department" ? "active" : ""}
              onClick={() => setScope("department")}
            >
              <UsersRound size={17} />
              В отдел
            </button>
          </div>
        </div>
        {scope !== "personal" && (
          <div className="form-grid two">
            <label>
              Компания
              <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            {scope === "department" && (
              <label>
                Отдел
                <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {availableDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
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
            <strong>Доступные инструкции для выбранного контекста</strong>
            <small>{instructionContextHint(scope)}</small>
          </div>
          <button className="ghost-button small" type="button" onClick={() => onNavigate("instructions")}>
            <Pencil size={15} />
            Изменить инструкцию
          </button>
        </div>
        <InstructionMiniList
          instructions={availableInstructions}
          companies={companies}
          departments={departments}
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

      <aside className="after-upload glass">
        <h2>После загрузки</h2>
        <p>Звонок автоматически пройдет обработку и будет доступен в обзоре звонка.</p>
        <StatusVertical />
        <div className="help-card">
          <CircleAlert size={21} />
          <strong>Нужна помощь?</strong>
          <span>Как загружать звонки</span>
          <ChevronRight size={16} />
        </div>
      </aside>
    </section>
  );
}

function AnalysisPage({
  session,
  calls,
  selectedCall,
  selectedCallId,
  analyses,
  instructions,
  companies,
  departments,
  onSelectCall,
  onAnalysisReady,
  onNavigate
}: {
  session: SessionState;
  calls: CallResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  analyses: Record<string, AnalysisResponse>;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onSelectCall: (callId: string) => void;
  onAnalysisReady: (callId: string, analysis: AnalysisResponse) => void;
  onNavigate: (page: AppPage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const analysis = selectedCall ? analyses[selectedCall.id] : undefined;
  const availableInstructions = selectedCall
    ? availableInstructionsForCall(instructions, selectedCall)
    : [];
  const summary = analysisSummary(analysis);
  const topics = analysisTopics(analysis);
  const nextStep = analysisNextStep(analysis);

  async function runAnalysis() {
    if (!selectedCall) return;
    setError("");
    setBusy(true);
    try {
      const result = await api.analyzeCall(session.accessToken, selectedCall.id);
      onAnalysisReady(selectedCall.id, result);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось запустить анализ");
    } finally {
      setBusy(false);
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
          {calls.map((call) => (
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
          ))}
        </div>
      </aside>
      <section className="analysis-detail glass">
        <div className="panel-heading large">
          <div>
            <h1>{selectedCall?.title ?? "Выберите звонок"}</h1>
            <p>Сводка, темы и следующий шаг по выбранному звонку.</p>
          </div>
          <button className="primary-button" onClick={runAnalysis} disabled={!selectedCall || busy}>
            <WandSparkles size={18} />
            {busy ? "Анализирую..." : "Запустить анализ"}
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="analysis-content-grid">
          <div className="info-card">
            <div className="card-title">
              <h3>Результат</h3>
              <span className="status-chip ok">{isAnalysisDone(analysis) ? "Готово" : "Нет анализа"}</span>
            </div>
            <div className="analysis-user-summary">
              <p>{summary}</p>
              <div>
                <strong>Ключевые темы</strong>
                <div className="topic-list">
                  {topics.length > 0 ? (
                    topics.map((topic) => <span key={topic}>{topic}</span>)
                  ) : (
                    <span>Появятся после анализа</span>
                  )}
                </div>
              </div>
              <div>
                <strong>Следующий шаг</strong>
                <p>{nextStep}</p>
              </div>
            </div>
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

function InstructionsPage({
  session,
  instructions,
  companies,
  departments,
  onInstructionCreated
}: {
  session: SessionState;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onInstructionCreated: (instruction: AnalysisInstruction) => void;
}) {
  const [title, setTitle] = useState("Инструкция анализа продаж");
  const [scope, setScope] = useState<InstructionScope>("department");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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

    setBusy(true);
    try {
      const created = await api.createInstruction(session.accessToken, {
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
          {(["personal", "company", "department"] as InstructionScope[]).map((item) => (
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
              <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            {scope === "department" && (
              <label>
                Отдел
                <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {departments
                    .filter((department) => department.company_uuid === companyId)
                    .map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        )}
        <label>
          Markdown-файл
          <div className="file-picker">
            <FileText size={22} />
            <label className="ghost-button file-button">
              Выбрать файл
              <input
                type="file"
                accept=".md,text/markdown,text/plain"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <span>{file?.name ?? "Файл не выбран"}</span>
          </div>
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" disabled={busy}>
          {busy ? "Загружаю..." : "Сохранить инструкцию"}
        </button>
      </form>
      <div className="instructions-list glass">
        <h2>Активные инструкции</h2>
        {instructionSections.length === 0 ? (
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

function TariffsPage() {
  return (
    <section className="tariffs-layout">
      <div className="tariff-hero glass">
        <h1>Тарифы MVP</h1>
        <p>Для проекта пока достаточно простой модели: ручная загрузка, минуты обработки и командный доступ.</p>
      </div>
      <div className="tariff-grid">
        {[
          ["Free", "Для проверки интерфейса", "до 20 минут"],
          ["Starter", "Для одного руководителя", "история звонков"],
          ["Pro", "Для команды продаж", "компании и отделы"]
        ].map(([name, text, feature]) => (
          <div className="tariff-card glass" key={name}>
            <h2>{name}</h2>
            <p>{text}</p>
            <strong>{feature}</strong>
            <button className="ghost-button wide">Выбрать</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductPreview({ compact }: { compact: boolean }) {
  return (
    <div className={`product-preview ${compact ? "compact" : ""}`}>
      <div className="preview-title">Последний звонок</div>
      <div className="preview-call">
        <span className="play-dot">
          <Play size={15} fill="currentColor" />
        </span>
        <div>
          <strong>Обсуждение условий.mp3</strong>
          <small>21 мая 2025 · 10:42 · 18:47</small>
        </div>
        <span className="status-chip ok">Анализ готов</span>
      </div>
      <div className="preview-grid">
        <div>
          <h3>Расшифровка</h3>
          <span className="status-chip warn">В процессе</span>
          <div className="progress"><i /></div>
          <p>Идет распознавание речи...</p>
        </div>
        <div>
          <h3>AI-анализ</h3>
          <span className="status-chip ok">Готово</span>
          <p>Общая оценка разговора: хорошо</p>
          <p>Следующий шаг: отправить КП</p>
        </div>
      </div>
      <div className="preview-recent">
        <span>Недавние звонки</span>
        <strong>Презентация продукта.mp3</strong>
        <small>Анализ готов</small>
      </div>
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="benefit">
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

function StatusChip({ status }: { status: CallStatus }) {
  const className = status === "failed" ? "bad" : status === "processing" ? "warn" : "ok";
  return <span className={`status-chip ${className}`}>{statusMeta[status].chip}</span>;
}

function StatusTimeline({ current }: { current: CallStatus }) {
  const steps: CallStatus[] = ["new", "processing", "transcribed", "analyzed", "failed"];
  const currentIndex = steps.indexOf(current);

  return (
    <div className="status-timeline">
      {steps.map((step, index) => (
        <div
          className={`timeline-step ${index <= currentIndex && current !== "failed" ? "done" : ""} ${
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
          <small>{step === current ? "сейчас" : "—"}</small>
        </div>
      ))}
    </div>
  );
}

function StatusVertical() {
  return (
    <div className="status-vertical">
      {(["new", "processing", "transcribed", "analyzed"] as CallStatus[]).map((status) => (
        <div key={status}>
          <span>
            {status === "new" && <CloudUpload size={17} />}
            {status === "processing" && <RefreshCw size={17} />}
            {status === "transcribed" && <FileText size={17} />}
            {status === "analyzed" && <Check size={17} />}
          </span>
          <div>
            <strong>{statusMeta[status].label}</strong>
            <small>{statusMeta[status].description}</small>
          </div>
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
      <button className="text-link" onClick={onAction}>
        {action}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function TranscriptPreview({ transcription }: { transcription?: TranscriptionResponse }) {
  if (!transcription?.text) {
    return <p className="muted">Расшифровка появится после обработки звонка.</p>;
  }

  return (
    <div className="transcript-preview">
      {transcription.text
        .split("\n")
        .slice(0, 4)
        .map((line, index) => (
          <p key={`${line}-${index}`}>
            <span>00:00:{String(index * 6).padStart(2, "0")}</span>
            {line}
          </p>
        ))}
    </div>
  );
}

function AnalysisPreview({ analysis }: { analysis?: AnalysisResponse }) {
  if (!analysis) {
    return <p className="muted">Запустите анализ после готовой расшифровки.</p>;
  }

  return (
    <div className="analysis-preview">
      <p>
        <Sparkles size={16} />
        Общая оценка разговора
        <strong>{isAnalysisDone(analysis) ? "Хорошо" : analysis.status}</strong>
      </p>
      <p>
        <Clock3 size={16} />
        Провайдер
        <strong>{analysis.provider}</strong>
      </p>
      <p>
        <FileText size={16} />
        Ключевые темы
        <strong>{Array.isArray((analysis.result_json as Record<string, unknown>)?.topics) ? "5" : "—"}</strong>
      </p>
    </div>
  );
}

function InstructionMiniList({
  instructions,
  companies,
  departments
}: {
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
}) {
  if (instructions.length === 0) {
    return (
      <div className="instruction-mini-list empty">
        <FileText size={18} />
        <span>Инструкций пока нет.</span>
      </div>
    );
  }

  return (
    <div className="instruction-mini-list">
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

function analysisRecord(analysis?: AnalysisResponse) {
  const result = analysis?.result_json;
  if (!result || Array.isArray(result) || typeof result !== "object") {
    return {};
  }

  return result as Record<string, unknown>;
}

function analysisSummary(analysis?: AnalysisResponse) {
  const record = analysisRecord(analysis);
  const summary = record.summary;
  if (typeof summary === "string" && summary.trim()) return summary;
  return analysis?.result_text ?? "Анализ появится здесь после обработки звонка.";
}

function analysisTopics(analysis?: AnalysisResponse) {
  const topics = analysisRecord(analysis).topics;
  if (!Array.isArray(topics)) return [];

  return topics.filter((topic): topic is string => typeof topic === "string" && topic.trim().length > 0);
}

function analysisNextStep(analysis?: AnalysisResponse) {
  const record = analysisRecord(analysis);
  const nextStep = record.next_step;
  if (typeof nextStep === "string" && nextStep.trim()) return nextStep;

  return "После анализа здесь появится рекомендуемое действие.";
}

export default App;
