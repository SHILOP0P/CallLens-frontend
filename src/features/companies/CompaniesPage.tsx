import {
  Building2,
  ChevronRight,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type {
  AppPage,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  Invitation,
  InvitationDepartmentRole,
  MembershipStatus,
  SessionState,
  Subscription,
  UserResponse
} from "../../types";

import { departmentRoleText, formatDate, membershipStatusText } from "../../shared/lib/formatters";
import { CallListSkeleton } from "../../shared/ui/loading";
import { ProfileField, SelectControl } from "../../shared/ui/primitives";
import { InvitationCreatePanel } from "../invitations/InvitationsPage";

export function CompaniesPage({
  session,
  companies,
  departments,
  loading,
  selectedCompanyId,
  selectedDepartmentId,
  onCompanyCreated,
  onDepartmentCreated,
  onNavigate,
  onOpenCompany,
  onOpenDepartment,
  onInvitationCreated
}: {
  session: SessionState;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading: boolean;
  selectedCompanyId: string;
  selectedDepartmentId: string;
  onCompanyCreated: (company: CompanyResponse) => void | Promise<void>;
  onDepartmentCreated: (department: DepartmentResponse) => void;
  onNavigate: (page: AppPage) => void;
  onOpenCompany: (companyId: string) => void;
  onOpenDepartment: (companyId: string, departmentId: string) => void;
  onInvitationCreated: (invitation: Invitation) => void;
}) {
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const selectedDepartment = departments.find(
    (department) => department.company_uuid === selectedCompanyId && department.id === selectedDepartmentId
  );

  if (selectedCompanyId) {
    if (loading && (!selectedCompany || (selectedDepartmentId && !selectedDepartment))) {
      return (
        <section className="companies-layout">
          <div className="company-workspace-empty glass">
            <CallListSkeleton count={3} compact />
          </div>
        </section>
      );
    }

    if (selectedDepartmentId) {
      return (
        <DepartmentWorkspace
          company={selectedCompany}
          department={selectedDepartment}
          session={session}
          onNavigate={onNavigate}
          onOpenCompany={onOpenCompany}
        />
      );
    }

    return (
      <CompanyWorkspace
        company={selectedCompany}
        departments={departments.filter((department) => department.company_uuid === selectedCompanyId)}
        session={session}
        onNavigate={onNavigate}
        onDepartmentCreated={onDepartmentCreated}
        onOpenDepartment={onOpenDepartment}
        onInvitationCreated={onInvitationCreated}
      />
    );
  }

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
                  <ProfileField label="Создана" value={formatDate(company.created_at)} />
                  <ProfileField label="Лимит участников" value={company.member_limit.toString()} />
                  <ProfileField label="Отделов" value={companyDepartments.length.toString()} />
                </div>
                <a
                  className="primary-button small company-link"
                  href={`/app/companies/${encodeURIComponent(company.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenCompany(company.id);
                  }}
                >
                  Открыть компанию
                  <ChevronRight size={16} />
                </a>
                <CompanySubscriptionStatus company={company} isManager={isManager} onNavigate={onNavigate} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function CompanyWorkspace({
  company,
  departments,
  session,
  onNavigate,
  onDepartmentCreated,
  onOpenDepartment,
  onInvitationCreated
}: {
  company?: CompanyResponse;
  departments: DepartmentResponse[];
  session: SessionState;
  onNavigate: (page: AppPage) => void;
  onDepartmentCreated: (department: DepartmentResponse) => void;
  onOpenDepartment: (companyId: string, departmentId: string) => void;
  onInvitationCreated: (invitation: Invitation) => void;
}) {
  if (!company) {
    return (
      <section className="companies-layout">
        <div className="company-workspace-empty glass">
          <Building2 size={34} />
          <div>
            <h1>Компания не найдена</h1>
            <p>Проверьте ссылку или вернитесь к списку компаний.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => onNavigate("companies")}>
            К списку компаний
          </button>
        </div>
      </section>
    );
  }

  const isManager = company.manager_user_uuid === session.user.id;

  return (
    <section className="company-workspace-layout">
      <div className="company-workspace-hero glass">
        <button className="text-button" type="button" onClick={() => onNavigate("companies")}>
          Назад к компаниям
        </button>
        <div className="company-workspace-title">
          <div>
            <h1>{company.name}</h1>
            <p>{isManager ? "Рабочая область менеджера компании" : "Рабочая область участника компании"}</p>
          </div>
          <span className={`status-chip ${isManager ? "ok" : "warn"}`}>
            {isManager ? "Менеджер" : "Участник"}
          </span>
        </div>
        <div className="company-meta-grid">
          <ProfileField label="Создана" value={formatDate(company.created_at)} />
          <ProfileField label="Лимит участников" value={company.member_limit.toString()} />
          <ProfileField label="Отделов" value={departments.length.toString()} />
        </div>
        <CompanySubscriptionStatus company={company} isManager={isManager} onNavigate={onNavigate} />
      </div>

      <div className="company-workspace-grid">
        <section className="company-card glass">
          <div className="panel-heading">
            <div>
              <h2>Отделы</h2>
              <p>Откройте отдел, чтобы посмотреть работников и роли.</p>
            </div>
          </div>
          {isManager && <CreateDepartmentForm companyId={company.id} onCreated={onDepartmentCreated} />}
          {departments.length === 0 ? (
            <div className="instruction-empty standalone">Отделов пока нет.</div>
          ) : (
            <div className="company-mini-list">
              {departments.map((department) => (
                <a
                  className="company-mini-card department-link"
                  href={`/app/companies/${encodeURIComponent(company.id)}/departments/${encodeURIComponent(department.id)}`}
                  key={department.id}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenDepartment(company.id, department.id);
                  }}
                >
                  <div>
                    <strong>{department.name}</strong>
                    <small>Создан: {formatDate(department.created_at)}</small>
                  </div>
                  <span className="status-chip ok">
                    Открыть
                    <ChevronRight size={14} />
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>

        {isManager ? (
          <InvitationCreatePanel
            companies={[company]}
            departments={departments}
            session={session}
            onInvitationCreated={onInvitationCreated}
          />
        ) : (
          <section className="company-card glass">
            <div className="company-lock-note">
              <LockKeyhole size={18} />
              <p>Приглашать пользователей и назначать роли может менеджер компании.</p>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export function DepartmentWorkspace({
  company,
  department,
  session,
  onNavigate,
  onOpenCompany
}: {
  company?: CompanyResponse;
  department?: DepartmentResponse;
  session: SessionState;
  onNavigate: (page: AppPage) => void;
  onOpenCompany: (companyId: string) => void;
}) {
  const [members, setMembers] = useState<DepartmentMemberResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(company && department));
  const [error, setError] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const isManager = company?.manager_user_uuid === session.user.id;

  useEffect(() => {
    if (!company || !department) return;

    let cancelled = false;
    const companyId = company.id;
    const departmentId = department.id;

    async function loadMembers() {
      try {
        setLoading(true);
        setError("");
        const response = await api.listDepartmentMembers(companyId, departmentId);
        if (!cancelled) setMembers(response);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить работников отдела");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [company?.id, department?.id]);

  async function updateMemberRole(member: DepartmentMemberResponse, role: InvitationDepartmentRole) {
    if (!company || !department) return;
    setBusyMemberId(member.user_uuid);
    setError("");
    try {
      const updated = await api.updateDepartmentMemberRole(company.id, department.id, member.user_uuid, role);
      setMembers((current) => current.map((item) => (item.user_uuid === updated.user_uuid ? updated : item)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Не удалось обновить роль работника");
    } finally {
      setBusyMemberId("");
    }
  }

  async function updateMemberStatus(member: DepartmentMemberResponse, status: MembershipStatus) {
    if (!company || !department) return;
    setBusyMemberId(member.user_uuid);
    setError("");
    try {
      const updated = await api.updateDepartmentMemberStatus(company.id, department.id, member.user_uuid, status);
      setMembers((current) => current.map((item) => (item.user_uuid === updated.user_uuid ? updated : item)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Не удалось обновить статус работника");
    } finally {
      setBusyMemberId("");
    }
  }

  if (!company || !department) {
    return (
      <section className="companies-layout">
        <div className="company-workspace-empty glass">
          <UsersRound size={34} />
          <div>
            <h1>Отдел не найден</h1>
            <p>Проверьте ссылку или вернитесь к списку компаний.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => onNavigate("companies")}>
            К списку компаний
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="department-workspace-layout">
      <div className="company-workspace-hero glass">
        <div className="panel-actions">
          <button className="text-button" type="button" onClick={() => onOpenCompany(company.id)}>
            Назад к компании
          </button>
          <button className="ghost-button small" type="button" onClick={() => onNavigate("companies")}>
            Все компании
          </button>
        </div>
        <div className="company-workspace-title">
          <div>
            <h1>{department.name}</h1>
            <p>{company.name} · работники отдела и назначенные роли.</p>
          </div>
          <span className={`status-chip ${isManager ? "ok" : "warn"}`}>
            {isManager ? "Менеджер" : "Просмотр"}
          </span>
        </div>
        <div className="company-meta-grid">
          <ProfileField label="Создан" value={formatDate(department.created_at)} />
          <ProfileField label="Работников" value={members.length.toString()} />
        </div>
      </div>

      <section className="company-card glass">
        <div className="panel-heading">
          <div>
            <h2>Работники отдела</h2>
            <p>Имена показываются, когда backend передаёт профиль работника.</p>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {loading ? (
          <CallListSkeleton count={3} compact />
        ) : members.length === 0 ? (
          <div className="instruction-empty standalone">В отделе пока нет работников.</div>
        ) : (
          <div className="department-member-list">
            {members.map((member) => (
              <DepartmentMemberRow
                key={member.user_uuid}
                member={member}
                currentUser={session.user}
                manager={isManager}
                busy={busyMemberId === member.user_uuid}
                onRoleChange={(role) => updateMemberRole(member, role)}
                onStatusChange={(status) => updateMemberStatus(member, status)}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export function DepartmentMemberRow({
  member,
  currentUser,
  manager,
  busy,
  onRoleChange,
  onStatusChange
}: {
  member: DepartmentMemberResponse;
  currentUser: UserResponse;
  manager: boolean;
  busy: boolean;
  onRoleChange: (role: InvitationDepartmentRole) => void;
  onStatusChange: (status: MembershipStatus) => void;
}) {
  const fullName =
    member.user_uuid === currentUser.id
      ? `${currentUser.full_surname} ${currentUser.full_name}`.trim()
      : `${member.full_surname ?? ""} ${member.full_name ?? ""}`.trim() || "Пользователь";
  const username = member.user_uuid === currentUser.id ? currentUser.username : member.username ?? "username не передан";

  return (
    <article className="department-member-row">
      <div>
        <strong>{fullName}</strong>
        <small>{username} · добавлен: {formatDate(member.created_at)}</small>
      </div>
      {manager ? (
        <>
          <SelectControl
            value={member.role}
            onChange={(event) => onRoleChange(event.target.value as InvitationDepartmentRole)}
            disabled={busy}
          >
            <option value="employee">Сотрудник</option>
            <option value="department_leader">Руководитель отдела</option>
          </SelectControl>
          <SelectControl
            value={member.status}
            onChange={(event) => onStatusChange(event.target.value as MembershipStatus)}
            disabled={busy}
          >
            <option value="active">Активен</option>
            <option value="suspended">Приостановлен</option>
            <option value="left">Покинул отдел</option>
          </SelectControl>
        </>
      ) : (
        <>
          <span className="status-chip ok">{departmentRoleText(member.role)}</span>
          <span className={`status-chip ${member.status === "active" ? "ok" : "warn"}`}>
            {membershipStatusText(member.status)}
          </span>
        </>
      )}
    </article>
  );
}

export function CreateDepartmentForm({
  companyId,
  onCreated
}: {
  companyId: string;
  onCreated: (department: DepartmentResponse) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Введите название отдела.");
      return;
    }

    setBusy(true);
    try {
      const department = await api.createDepartment(companyId, name.trim());
      onCreated(department);
      setName("");
      setSuccess("Отдел создан.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось создать отдел");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="create-department-form" onSubmit={submit}>
      <label>
        Название отдела
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
      <button className="primary-button small" type="submit" disabled={busy}>
        <Plus size={16} />
        {busy ? "Создаю..." : "Создать отдел"}
      </button>
    </form>
  );
}

export function CompanySubscriptionStatus({
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

export function CreateCompanyForm({ onCreated }: { onCreated: (company: CompanyResponse) => void | Promise<void>; }) {
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

export function CompanyEmptyState({
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

export function CompanyMiniCard({ company, manager }: { company: CompanyResponse; manager: boolean; }) {
  return (
    <div className="company-mini-card">
      <div>
        <strong>{company.name}</strong>
        <small>Создана: {formatDate(company.created_at)}</small>
      </div>
      <span className={`status-chip ${manager ? "ok" : "warn"}`}>
        {manager ? "Менеджер" : "Участник"}
      </span>
    </div>
  );
}
