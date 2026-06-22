import {
  Bell,
  Building2,
  CircleUserRound,
  CloudUpload,
  FileText
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
  upload: "/app/upload",
  analysis: "/app/analysis",
  instructions: "/app/instructions",
  invitations: "/app/invitations",
  companies: "/app/companies",
  profile: "/app/profile",
  tariffs: "/app/tariffs"
};

export const navItems: Array<{ page: AppPage; label: string; }> = [
  { page: "overview", label: "Обзор" },
  { page: "calls", label: "Звонки" },
  { page: "analysis", label: "AI-анализ" },
  { page: "tariffs", label: "Тарифы" }
];

export const sidebarItems: Array<{ page: AppPage; label: string; icon: React.ReactNode; }> = [
  { page: "upload", label: "Загрузка", icon: <CloudUpload size={18} /> },
  { page: "companies", label: "Компании", icon: <Building2 size={18} /> },
  { page: "instructions", label: "Инструкции", icon: <FileText size={18} /> },
  { page: "invitations", label: "Приглашения", icon: <Bell size={18} /> },
  { page: "profile", label: "Профиль", icon: <CircleUserRound size={18} /> }
];

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
  if (pathname.startsWith("/app/companies/")) return "companies";
  const entry = Object.entries(pageRoutes).find(([, route]) => route === pathname);
  return (entry?.[0] as AppPage | undefined) ?? "calls";
}

export function companyIdFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/companies\/([^/]+)(?:\/departments\/[^/]+)?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function departmentIdFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/companies\/[^/]+\/departments\/([^/]+)$/);
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
