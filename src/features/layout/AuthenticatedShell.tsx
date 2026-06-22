import {
  Bell,
  LogOut,
  Moon
} from "lucide-react";
import type {
  AppPage,
  SessionState
} from "../../types";

import { AppTheme, navItems, sidebarItems, ThemeToggleEvent } from "../../app/runtime";
import { Logo } from "../../shared/ui/primitives";

export function AuthenticatedShell({
  activePage,
  session,
  theme,
  invitationCount,
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
            const badge = item.page === "invitations" && invitationCount > 0 ? invitationCount : 0;

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
