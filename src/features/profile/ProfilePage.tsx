import {
  ChevronRight,
  Pencil
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api";
import type {
  AppPage,
  CompanyResponse,
  SessionState,
  UserResponse
} from "../../types";

import { formatDate } from "../../shared/lib/formatters";
import { ProfileField } from "../../shared/ui/primitives";
import { CompanyEmptyState, CompanyMiniCard } from "../companies/CompaniesPage";

export function ProfilePage({
  session,
  companies,
  onUserUpdated,
  onCompanyCreated,
  onNavigate
}: {
  session: SessionState;
  companies: CompanyResponse[];
  onUserUpdated: (user: UserResponse) => void;
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
          <ProfileField label="Username" value={session.user.username} />
          <ProfileField label="Роль" value={session.user.role} />
          <ProfileField label="Дата регистрации" value={formatDate(session.user.created_at)} />
          <UsernameEditor user={session.user} onUserUpdated={onUserUpdated} />
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

export function UsernameEditor({
  user,
  onUserUpdated
}: {
  user: UserResponse;
  onUserUpdated: (user: UserResponse) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUsername(user.username);
  }, [user.username]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess("");
    setError("");

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("Введите username.");
      return;
    }

    setBusy(true);
    try {
      const updatedUser = await api.updateUsername(trimmedUsername);
      onUserUpdated(updatedUser);
      setSuccess("Username обновлен.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Не удалось обновить username");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="username-editor" onSubmit={submit}>
      <label>
        Изменить username
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@muxa" />
      </label>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
      <button className="primary-button small" type="submit" disabled={busy}>
        <Pencil size={16} />
        {busy ? "Сохраняю..." : "Сохранить username"}
      </button>
    </form>
  );
}
