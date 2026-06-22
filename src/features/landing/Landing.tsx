import {
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  CloudUpload,
  FileAudio,
  FileText,
  Headphones,
  LockKeyhole,
  Moon,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WandSparkles,
  X
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type {
  Plan,
  SessionState
} from "../../types";

import { AppTheme, ThemeToggleEvent, useRevealOnScroll } from "../../app/runtime";
import { normalTimelineSteps, statusMeta } from "../../shared/lib/call-status";
import { comparePlans } from "../../shared/lib/plans";
import { Logo } from "../../shared/ui/primitives";
import { TariffSection, TariffSkeleton } from "../tariffs/TariffsPage";

export function Landing({
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

export function AuthDialog({
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
  const [username, setUsername] = useState("");
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
            ...(username.trim() ? { username: username.trim() } : {}),
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
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="@muxa"
                />
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

export function ProductPreview({ compact }: { compact: boolean; }) {
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

export function WorkflowStep({ icon, title, text }: { icon: React.ReactNode; title: string; text: string; }) {
  return (
    <div className="workflow-step" data-reveal-item>
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function SecurityItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string; }) {
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

export function LandingTariffPreview() {
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

export function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string; }) {
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
