import {
  ArrowRight,
  Building2,
  CreditCard,
  FileText,
  Settings
} from "lucide-react";
import type { AppPage } from "../../types";
import { settingsRoutes } from "../../app/runtime";

const settingsIcons: Partial<Record<AppPage, React.ReactNode>> = {
  settingsTariffs: <CreditCard size={22} />,
  settingsCompanies: <Building2 size={22} />,
  settingsInstructions: <FileText size={22} />
};

export function SettingsPage({ onNavigate }: { onNavigate: (page: AppPage) => void; }) {
  return (
    <section className="settings-overview app-page atmospheric-page">
      <div className="app-page-heading settings-heading">
        <span className="settings-heading-icon" aria-hidden="true">
          <Settings size={28} />
        </span>
        <div>
          <h1>Настройки</h1>
          <p>Выберите раздел настроек. Тарифы, компании, инструкции и профиль открываются как отдельные внутренние страницы.</p>
        </div>
      </div>
      <div className="settings-card-grid glass-panel">
        {settingsRoutes.map((item) => (
          <button
            className="settings-card"
            type="button"
            key={item.page}
            onClick={() => onNavigate(item.page)}
          >
            <span className="settings-card-icon">{settingsIcons[item.page]}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            <span className="settings-card-action">
              Открыть
              <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
