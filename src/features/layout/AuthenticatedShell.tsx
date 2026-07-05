import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Moon,
  Search,
  CheckCheck,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import type {
  AppPage,
  CallResponse,
  CompanyResponse,
  NotificationResponse,
  SessionState,
  SearchResponse,
  Subscription,
  SubscriptionUsageResponse
} from "../../types";

import { AppTheme, isSettingsPage, sidebarItems, ThemeToggleEvent } from "../../app/runtime";
import { Logo } from "../../shared/ui/primitives";

export function AuthenticatedShell({
  activePage,
  session,
  theme,
  calls,
  companies,
  personalSubscription,
  companySubscriptions,
  invitationCount,
  children,
  onNavigate,
  onOpenCall,
  onOpenCompany,
  onOpenLanding,
  onToggleTheme,
  onLogout
}: {
  activePage: AppPage;
  session: SessionState;
  theme: AppTheme;
  calls: CallResponse[];
  companies: CompanyResponse[];
  personalSubscription: Subscription | null;
  companySubscriptions: Record<string, Subscription | null>;
  invitationCount: number;
  children: React.ReactNode;
  onNavigate: (page: AppPage) => void;
  onOpenCall: (callId: string) => void;
  onOpenCompany: (companyId: string) => void;
  onOpenLanding: () => void;
  onToggleTheme: (event: ThemeToggleEvent) => void;
  onLogout: () => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(invitationCount);
  const [personalUsage, setPersonalUsage] = useState<SubscriptionUsageResponse | null>(null);
  const [companyUsage, setCompanyUsage] = useState<Record<string, SubscriptionUsageResponse | null>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const teamPopoverRef = useRef<HTMLDivElement>(null);
  const searchPopoverRef = useRef<HTMLLabelElement>(null);
  const notificationPopoverRef = useRef<HTMLDivElement>(null);
  const themeLabel = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
  const activeSidebarPage = isSettingsPage(activePage) ? "settings" : activePage;
  const fullName = `${session.user.full_name} ${session.user.full_surname}`.trim();
  const avatarInitial = profileInitial(session.user.full_surname || session.user.full_name || session.user.username);
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const hasCompanies = companies.length > 0;
  const hasMultipleCompanies = companies.length > 1;
  const teamLabel = selectedCompany?.name ?? "Личный кабинет";
  const selectedCompanySubscription = selectedCompany?.id ? companySubscriptions[selectedCompany.id] : null;
  const selectedCompanyUsage = selectedCompany?.id ? companyUsage[selectedCompany.id] : undefined;
  const activeUsage = selectedCompany ? selectedCompanyUsage ?? null : personalUsage;
  const usageSubscription =
    activeUsage?.subscription.status === "active" && activeUsage.subscription.id
      ? activeUsage.subscription
      : null;
  const fallbackSubscription = selectedCompany
    ? selectedCompanySubscription?.status === "active"
      ? selectedCompanySubscription
      : null
    : personalSubscription?.status === "active"
      ? personalSubscription
      : null;
  const subscription = usageSubscription ?? fallbackSubscription;
  const usageLoading =
    Boolean(subscription) &&
    (selectedCompany ? selectedCompanyUsage === undefined : personalUsage === null);
  const usedMinutes = activeUsage?.used_minutes ?? 0;
  const limitMinutes = activeUsage?.limit_minutes ?? 0;
  const remainingMinutes = activeUsage?.remaining_minutes ?? 0;
  const progress = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        activeUsage
          ? activeUsage.percent
          : 0
      )
    )
  );
  const hasSearchResults = Boolean(
    searchResults &&
      (searchResults.calls.length > 0 ||
        searchResults.companies.length > 0 ||
        searchResults.reports.length > 0 ||
        searchResults.instructions.length > 0)
  );

  useEffect(() => {
    if (!companies.length) {
      setSelectedCompanyId("");
      setTeamOpen(false);
      return;
    }

    if (selectedCompanyId && !companies.some((company) => company.id === selectedCompanyId)) {
      setSelectedCompanyId("");
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      const [loadedPersonalUsage, loadedCompanyUsage] = await Promise.all([
        api.getSubscriptionUsage().catch(() => null),
        Promise.all(
          companies.map(async (company) => [
            company.id,
            await api.getCompanySubscriptionUsage(company.id).catch(() => null)
          ] as const)
        )
      ]);

      if (cancelled) return;
      setPersonalUsage((current) => loadedPersonalUsage ?? current);
      setCompanyUsage((current) => {
        const next = { ...current };
        for (const [companyId, usage] of loadedCompanyUsage) {
          if (usage) next[companyId] = usage;
        }
        return next;
      });
    }

    loadUsage();
    return () => {
      cancelled = true;
    };
  }, [companies, calls.length, personalSubscription?.id, companySubscriptions]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferencesAndNotifications() {
      const [preferences, notificationResponse] = await Promise.all([
        api.getPreferences().catch(() => null),
        api.listNotifications({ limit: 8 }).catch(() => null)
      ]);

      if (cancelled) return;
      if (preferences) {
        setSelectedCompanyId(preferences.active_company_uuid ?? "");
        setDateFrom(preferences.date_range.from ?? "");
        setDateTo(preferences.date_range.to ?? "");
      }
      if (notificationResponse) {
        setNotifications(notificationResponse.notifications);
        setUnreadNotifications(notificationResponse.unread_count);
      }
    }

    loadPreferencesAndNotifications();
    return () => {
      cancelled = true;
    };
  }, [companies]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      api
        .search({ q: query, types: ["calls", "companies", "reports", "instructions"], limit: 5 })
        .then((response) => {
          if (!cancelled) setSearchResults(response);
        })
        .catch(() => {
          if (!cancelled) setSearchResults(null);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!teamOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!teamPopoverRef.current?.contains(event.target as Node)) {
        setTeamOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [teamOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!searchPopoverRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [searchOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!notificationPopoverRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [notificationsOpen]);

  function persistPreferences(next: {
    active_company_uuid?: string | null;
    date_range?: { from?: string | null; to?: string | null };
  }) {
    api.updatePreferences(next).catch(() => undefined);
  }

  function openNotification(notification: NotificationResponse) {
    api.markNotificationRead(notification.id).catch(() => undefined);
    setNotifications((current) =>
      current.map((item) => item.id === notification.id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item)
    );
    setUnreadNotifications((current) => Math.max(0, current - (notification.read_at ? 0 : 1)));
    setNotificationsOpen(false);

    if (notification.entity_type === "call" && notification.entity_uuid) {
      onOpenCall(notification.entity_uuid);
      return;
    }
    if (notification.entity_type === "company" && notification.entity_uuid) {
      onOpenCompany(notification.entity_uuid);
      return;
    }
    if (notification.type === "invitation") onNavigate("settingsInvitations");
    if (notification.entity_type === "report") onNavigate("reports");
    if (notification.entity_type === "instruction") onNavigate("settingsInstructions");
  }

  async function markAllNotificationsRead() {
    await api.markAllNotificationsRead().catch(() => undefined);
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read_at: notification.read_at ?? new Date().toISOString() }))
    );
    setUnreadNotifications(0);
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <header className="app-header">
        <div className="app-header-left">
          <Logo onClick={onOpenLanding} />
          {hasCompanies && (
            <div className="header-popover-wrap" ref={teamPopoverRef}>
              <button
                className={`team-switcher ${teamOpen ? "active" : ""} ${!hasMultipleCompanies ? "single" : ""}`}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={teamOpen}
                onClick={() => setTeamOpen((open) => !open)}
              >
                <span>{teamLabel}</span>
                <ChevronDown size={15} />
              </button>
              {teamOpen && (
                <div className="header-popover team-popover" role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedCompany}
                    className={!selectedCompany ? "active" : ""}
                    onClick={() => {
                      setSelectedCompanyId("");
                      setTeamOpen(false);
                      persistPreferences({ active_company_uuid: null });
                    }}
                  >
                    <span>
                      <strong>Личный кабинет</strong>
                      <small>{personalSubscription?.plan.name ?? "Личный тариф не активирован"}</small>
                    </span>
                  </button>
                  {companies.map((company) => {
                    const companySubscription = companySubscriptions[company.id];
                    return (
                      <button
                        type="button"
                        key={company.id}
                        role="option"
                        aria-selected={company.id === selectedCompany?.id}
                        className={company.id === selectedCompany?.id ? "active" : ""}
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          setTeamOpen(false);
                          persistPreferences({ active_company_uuid: company.id });
                          onOpenCompany(company.id);
                        }}
                      >
                        <span>
                          <strong>{company.name}</strong>
                          <small>{companySubscription?.plan.name ?? "Подписка не активна"}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="app-header-center">
          <label className="global-search header-popover-wrap" ref={searchPopoverRef}>
            <Search size={19} />
            <input
              value={searchQuery}
              placeholder="Поиск по звонкам, компаниям, отчетам, инструкциям..."
              aria-label="Глобальный поиск"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && (
              <div className="header-popover search-popover">
                <div className="popover-head">
                  <strong>Результаты</strong>
                </div>
                {searchQuery.trim().length < 2 ? (
                  <span className="popover-empty">Введите минимум 2 символа</span>
                ) : searchLoading ? (
                  <span className="popover-empty">Ищу...</span>
                ) : !hasSearchResults ? (
                  <span className="popover-empty">Ничего не найдено</span>
                ) : (
                  <>
                    {searchResults?.calls.map((call) => (
                      <button
                        type="button"
                        key={call.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onOpenCall(call.id);
                        }}
                      >
                        <span>
                          <strong>{call.title}</strong>
                          <small>Звонок · {formatShortDate(call.created_at)}</small>
                        </span>
                      </button>
                    ))}
                    {searchResults?.companies.map((company) => (
                      <button
                        type="button"
                        key={company.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onOpenCompany(company.id);
                        }}
                      >
                        <span>
                          <strong>{company.name}</strong>
                          <small>Компания</small>
                        </span>
                      </button>
                    ))}
                    {searchResults?.reports.map((report) => (
                      <button
                        type="button"
                        key={report.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onNavigate("reports");
                        }}
                      >
                        <span>
                          <strong>{report.file_name}</strong>
                          <small>Отчет · {report.status}</small>
                        </span>
                      </button>
                    ))}
                    {searchResults?.instructions.map((instruction) => (
                      <button
                        type="button"
                        key={instruction.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onNavigate("settingsInstructions");
                        }}
                      >
                        <span>
                          <strong>{instruction.title}</strong>
                          <small>Инструкция · {instruction.scope}</small>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </label>
          <div className="header-popover-wrap">
            <button
              className={`date-range-control ${calendarOpen ? "active" : ""}`}
              type="button"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((open) => !open)}
            >
              <CalendarDays size={18} />
              {formatDateRange(dateFrom, dateTo)}
            </button>
            {calendarOpen && (
              <div className="header-popover calendar-popover">
                <div className="popover-head">
                  <strong>Период</strong>
                  <button type="button" onClick={() => setCalendarOpen(false)} aria-label="Закрыть календарь">
                    <X size={15} />
                  </button>
                </div>
                <label>
                  С
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      persistPreferences({ date_range: { from: event.target.value || null, to: dateTo || null } });
                    }}
                  />
                </label>
                <label>
                  По
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      persistPreferences({ date_range: { from: dateFrom || null, to: event.target.value || null } });
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="profile-block">
          <div className="header-popover-wrap" ref={notificationPopoverRef}>
            <button
              className={`icon-button notification-button ${notificationsOpen ? "active" : ""}`}
              aria-label="Уведомления"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={19} />
              {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications}</span>}
            </button>
            {notificationsOpen && (
              <div className="header-popover notifications-popover">
                <div className="popover-head">
                  <strong>Уведомления</strong>
                  <button type="button" onClick={markAllNotificationsRead} aria-label="Прочитать все">
                    <CheckCheck size={15} />
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <span className="popover-empty">Новых событий нет</span>
                ) : (
                  notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={notification.read_at ? "" : "unread"}
                      onClick={() => openNotification(notification)}
                    >
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.body}</small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button className="icon-button theme-toggle" type="button" onClick={onToggleTheme} aria-label={themeLabel}>
            <Moon size={19} fill={theme === "dark" ? "currentColor" : "none"} />
          </button>
          <button
            className="header-profile-link"
            type="button"
            onClick={() => onNavigate("settingsProfile")}
            aria-label="Открыть профиль"
          >
            <span className="avatar" aria-hidden="true">{avatarInitial}</span>
            <strong>{fullName || "Пользователь"}</strong>
          </button>
          <button className="icon-button logout" onClick={onLogout} aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="workspace-frame">
        <aside className="app-sidebar" aria-label="Рабочие разделы">
          <div className="app-sidebar-menu">
            {sidebarItems.map((item) => (
                <button
                  key={item.page}
                  className={activeSidebarPage === item.page ? "active" : ""}
                  type="button"
                  onClick={() => onNavigate(item.page)}
                >
                  <span>
                    {item.icon}
                    <span className="sidebar-label">{item.label}</span>
                  </span>
                  {item.page === "settings" && invitationCount > 0 && <small>{invitationCount}</small>}
                </button>
              ))}
          </div>
          <div className="app-sidebar-plan" aria-label="Тариф и лимиты">
            <div className="sidebar-plan-card">
              <small>{subscription?.plan.name ?? "Подключите тариф"}</small>
            </div>
            <div className="sidebar-limit-card">
              <span>Лимит расшифровки</span>
              <strong>
                {usageLoading
                  ? "Загрузка лимита"
                  : limitMinutes > 0
                    ? `${formatMinutes(usedMinutes)} / ${formatMinutes(limitMinutes)}`
                    : "Нет активного лимита"}
              </strong>
              {limitMinutes > 0 && !usageLoading && <small>Осталось {formatMinutes(remainingMinutes)}</small>}
              <div className="sidebar-progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button
              className="sidebar-collapse"
              type="button"
              aria-label={sidebarCollapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
              <span>{sidebarCollapsed ? "Развернуть" : "Свернуть"}</span>
            </button>
          </div>
        </aside>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}

function profileInitial(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toUpperCase() : "П";
}

function totalMinutes(calls: CallResponse[]) {
  return Math.ceil(calls.reduce((sum, call) => sum + call.duration_seconds, 0) / 60);
}

function formatMinutes(minutes: number) {
  return `${minutes} мин`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateRange(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return "Выберите период";

  const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "short" });
  const yearFormatter = new Intl.DateTimeFormat("ru-RU", { year: "numeric" });
  const fromMonth = monthFormatter.format(fromDate).replace(".", "");
  const toMonth = monthFormatter.format(toDate).replace(".", "");
  const fromYear = yearFormatter.format(fromDate);
  const toYear = yearFormatter.format(toDate);

  if (fromYear === toYear) {
    return `${fromDate.getDate()} ${fromMonth} - ${toDate.getDate()} ${toMonth} ${toYear}`;
  }

  return `${fromDate.getDate()} ${fromMonth} ${fromYear} - ${toDate.getDate()} ${toMonth} ${toYear}`;
}
