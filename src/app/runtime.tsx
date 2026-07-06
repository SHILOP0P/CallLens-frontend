import {
  Activity,
  BarChart3,
  BrainCircuit,
  Building2,
  FileBarChart2,
  LayoutDashboard,
  CloudUpload,
  PhoneCall,
  Settings
} from "lucide-react";
import { useEffect } from "react";
import type {
  AppPage,
  SessionState
} from "../types";

export const SESSION_KEY = "calllens.session.v1";

export const THEME_KEY = "calllens.theme.v1";

export type AppTheme = "light" | "dark";

export type ThemePreference = AppTheme | "system";

export type ThemeToggleEvent = React.MouseEvent<HTMLButtonElement>;

export type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void>; };
};

export function getSystemTheme(): AppTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readThemePreference(): ThemePreference {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

export const pageRoutes: Record<AppPage, string> = {
  overview: "/app/overview",
  calls: "/app/calls",
  analysis: "/app/analysis",
  reports: "/app/reports",
  monitoring: "/app/monitoring",
  settings: "/app/settings",
  settingsTariffs: "/app/settings/tariffs",
  settingsCompanies: "/app/settings/companies",
  settingsInstructions: "/app/settings/instructions",
  settingsInvitations: "/app/settings/invitations",
  settingsProfile: "/app/settings/profile",
  settingsProfileEdit: "/app/settings/profile/edit",
  settingsDevices: "/app/settings/devices",
  upload: "/app/upload"
};

export const navItems: Array<{ page: AppPage; label: string; }> = [
  { page: "overview", label: "Обзор" },
  { page: "calls", label: "Звонки" },
  { page: "analysis", label: "Аналитика" },
  { page: "reports", label: "AI-отчеты" },
  { page: "monitoring", label: "Мониторинг" },
  { page: "settings", label: "Настройки" }
];

export const sidebarItems: Array<{ page: AppPage; label: string; icon: React.ReactNode; }> = [
  { page: "overview", label: "Обзор", icon: <LayoutDashboard size={19} /> },
  { page: "calls", label: "Звонки", icon: <PhoneCall size={19} /> },
  { page: "analysis", label: "Аналитика", icon: <BarChart3 size={19} /> },
  { page: "reports", label: "AI-отчеты", icon: <FileBarChart2 size={19} /> },
  { page: "monitoring", label: "Мониторинг", icon: <Activity size={19} /> },
  { page: "settingsCompanies", label: "Компании", icon: <Building2 size={19} /> },
  { page: "settings", label: "Настройки", icon: <Settings size={19} /> }
];

export const quickActionItems: Array<{ page: AppPage; label: string; icon: React.ReactNode; }> = [
  { page: "upload", label: "Загрузка", icon: <CloudUpload size={18} /> },
  { page: "analysis", label: "AI-анализ", icon: <BrainCircuit size={18} /> }
];

export const settingsRoutes: Array<{ page: AppPage; label: string; description: string; }> = [
  {
    page: "settingsTariffs",
    label: "Тарифы",
    description: "План, лимиты расшифровки и условия команды."
  },
  {
    page: "settingsCompanies",
    label: "Компании",
    description: "Организации, отделы, участники и роли доступа."
  },
  {
    page: "settingsInstructions",
    label: "Инструкции",
    description: "Правила и критерии для AI-анализа звонков."
  },
  {
    page: "settingsProfile",
    label: "Профиль",
    description: "Личные данные, безопасность и уведомления."
  },
  {
    page: "settingsDevices",
    label: "Устройства",
    description: "Активные входы, браузеры и завершение лишних сессий."
  }
];

const pathAliases: Record<string, AppPage> = {
  "/app/tariffs": "settingsTariffs",
  "/app/companies": "settingsCompanies",
  "/app/instructions": "settingsInstructions",
  "/app/invitations": "settingsInvitations",
  "/app/profile": "settingsProfile",
  "/app/devices": "settingsDevices"
};

export function isSettingsPage(page: AppPage) {
  return page === "settings" || page.startsWith("settings");
}

export function readStoredSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as SessionState & { demo?: boolean; };
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

export function pageFromPath(pathname: string): AppPage {
  if (/^\/app\/settings\/companies\/[^/]+(?:\/departments\/[^/]+)?$/.test(pathname)) return "settingsCompanies";
  if (/^\/app\/companies\/[^/]+(?:\/departments\/[^/]+)?$/.test(pathname)) return "settingsCompanies";
  if (pathname === "/app/settings/profile/edit") return "settingsProfileEdit";

  const entry = Object.entries(pageRoutes).find(([, route]) => route === pathname);
  if (entry) return entry[0] as AppPage;

  const alias = pathAliases[pathname];
  return alias ?? "overview";
}

export function companyIdFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/(?:settings\/)?companies\/([^/]+)(?:\/departments\/[^/]+)?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function departmentIdFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/(?:settings\/)?companies\/[^/]+\/departments\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function persistSession(session: SessionState | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function useRevealOnScroll<T extends HTMLElement>() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll<T>("[data-reveal], [data-reveal-item]").forEach((target) => {
        target.classList.add("is-visible");
      });
      return;
    }

    document.documentElement.classList.add("reveal-ready");

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

    const revealFallback = window.setTimeout(() => {
      if (document.querySelector("[data-reveal-item].is-visible")) return;
      document.querySelectorAll<T>("[data-reveal], [data-reveal-item]").forEach((target) => {
        target.classList.add("is-visible");
      });
    }, 900);

    const mutationObserver = new MutationObserver(observeTargets);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      window.clearTimeout(revealFallback);
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, []);
}
