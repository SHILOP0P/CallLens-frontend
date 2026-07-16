import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, Headphones, RefreshCw, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { api, ApiError, getAdminCallAudioBlob } from "../../api";
import { isVideoCall } from "../../shared/lib/media";
import { SelectControl } from "../../shared/ui/primitives";
import type {
  AdminCapabilitiesResponse,
  CallResponse,
  CompanyResponse,
  AdminSubscriptionResponse,
  Plan,
  UpdateAdminUserProfileRequest,
  UserResponse,
  UserSessionResponse
} from "../../types";

type AdminSection = "users" | "companies";
type SubscriptionOwner = "users" | "companies";

const has = (capabilities: AdminCapabilitiesResponse, permission: string) => capabilities.permissions.includes(permission);

export function AdminPage({ capabilities, currentUserId }: { capabilities: AdminCapabilitiesResponse; currentUserId: string }) {
  const availableSections = useMemo<AdminSection[]>(() => [
    ...(has(capabilities, "admin.users.read") ? ["users" as const] : []),
    ...(has(capabilities, "admin.companies.read") ? ["companies" as const] : [])
  ], [capabilities]);
  const [section, setSection] = useState<AdminSection>(availableSections[0] ?? "users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Record<AdminSection, boolean>>({ users: false, companies: false });
  const [notice, setNotice] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async (nextSection: AdminSection, search: string) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setNotice("");
    try {
      if (nextSection === "users") {
        const response = await api.listAdminUsers({ q: search.trim(), limit: 50, offset: 0 });
        if (requestId !== requestSequence.current) return;
        setUsers(response.items);
        setUsersTotal(response.total);
      } else {
        const response = await api.listAdminCompanies({ q: search.trim(), limit: 50, offset: 0 });
        if (requestId !== requestSequence.current) return;
        setCompanies(response.items);
        setCompaniesTotal(response.total);
      }
    } catch (error) {
      if (requestId === requestSequence.current) setNotice(message(error));
    } finally {
      if (requestId !== requestSequence.current) return;
      setLoaded((current) => ({ ...current, [nextSection]: true }));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!availableSections.includes(section)) setSection(availableSections[0] ?? "users");
  }, [availableSections, section]);

  useEffect(() => {
    void load(section, "");
  }, [load, section]);

  async function openUser(user: UserResponse) {
    setNotice("");
    try {
      setSelectedUser(await api.getAdminUser(user.id));
    } catch (error) {
      setNotice(message(error));
    }
  }

  async function openCompany(company: CompanyResponse) {
    setNotice("");
    try {
      setSelectedCompany(await api.getAdminCompany(company.id));
    } catch (error) {
      setNotice(message(error));
    }
  }

  function replaceUser(updated: UserResponse) {
    setSelectedUser(updated);
    setUsers((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  function replaceCompany(updated: CompanyResponse) {
    setSelectedCompany(updated);
    setCompanies((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  if (selectedUser) {
    return <UserDetail user={selectedUser} capabilities={capabilities} onBack={() => setSelectedUser(null)} onUpdated={replaceUser} />;
  }
  if (selectedCompany) {
    return <CompanyDetail company={selectedCompany} capabilities={capabilities} currentUserId={currentUserId} onBack={() => setSelectedCompany(null)} onUpdated={replaceCompany} />;
  }

  return <section className="admin-page">
    <AdminHeading capabilities={capabilities} />
    <div className="admin-layout">
      <nav className="admin-nav" aria-label="Административные разделы">
        {has(capabilities, "admin.users.read") && <button className={section === "users" ? "active" : ""} type="button" onClick={() => setSection("users")}><span><Users size={17} />Пользователи</span></button>}
        {has(capabilities, "admin.companies.read") && <button className={section === "companies" ? "active" : ""} type="button" onClick={() => setSection("companies")}><span><Building2 size={17} />Компании</span></button>}
      </nav>
      <div className="admin-content">
        <>
          <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); void load(section, query); }}>
            <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === "users" ? "Имя, @username или email" : "Название или тег компании"} /></label>
            <button className="ghost-button small" type="submit">Найти</button>
            <button className="icon-button" type="button" aria-label="Обновить" aria-busy={loading} disabled={loading} onClick={() => void load(section, query)}><RefreshCw className={loading ? "refresh-icon spinning" : "refresh-icon"} size={17} /></button>
          </form>
          <p className="admin-section-summary">{section === "users" ? `Пользователей: ${usersTotal}` : `Компаний: ${companiesTotal}`}</p>
          {notice && <p className="admin-notice" role="status">{notice}</p>}
          <div className="admin-results" aria-busy={loading}>
            {loading && !loaded[section] ? <p className="admin-empty">Загрузка данных…</p> : section === "users" ? <UsersTable users={users} onOpen={openUser} /> : <CompaniesTable companies={companies} onOpen={openCompany} />}
          </div>
        </>
      </div>
    </div>
  </section>;
}

function AdminHeading({ capabilities }: { capabilities: AdminCapabilitiesResponse }) {
  return <header className="admin-page-head app-page-heading settings-heading admin-heading"><span className="settings-heading-icon" aria-hidden="true"><ShieldCheck size={30} /></span><div><p className="eyebrow">ОПЕРАЦИОННАЯ ЗОНА</p><h1>Администрирование</h1></div><span className="admin-role-badge"><ShieldCheck size={15} />{roleLabel(capabilities.role)}</span></header>;
}

function UserDetail({ user, capabilities, onBack, onUpdated }: { user: UserResponse; capabilities: AdminCapabilitiesResponse; onBack: () => void; onUpdated: (user: UserResponse) => void }) {
  const [notice, setNotice] = useState("");
  const canEditProfile = has(capabilities, "admin.users.manage") && canTargetRole(capabilities.role, user.role);
  const canManageRole = canChangeRole(capabilities, user.role);
  return <section className="admin-page admin-user-page">
    <div className="settings-back-row"><button className="ghost-button small" type="button" onClick={onBack}><ArrowLeft size={16} />К пользователям</button></div>
    <header className="admin-page-head app-page-heading settings-heading admin-heading admin-profile-heading"><span className="settings-heading-icon" aria-hidden="true"><UserRound size={30} /></span><div><p className="eyebrow">КАРТОЧКА ПОЛЬЗОВАТЕЛЯ</p><h1>{fullName(user)}</h1><p>{user.username} · {user.email}</p><span className="chip">{roleLabel(user.role)}</span></div><UserAvatar user={user} /></header>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <div className="admin-profile-grid">
      <section className="admin-detail"><h2>Профиль</h2><UserFacts user={user} />
        {canEditProfile && <ProfileEditor user={user} onSaved={onUpdated} onNotice={setNotice} />}
        {canManageRole && <RoleEditor user={user} capabilities={capabilities} onSaved={onUpdated} onNotice={setNotice} />}
      </section>
      <section className="admin-detail"><h2>Доступ и безопасность</h2>
        {has(capabilities, "admin.sessions.read") && <SessionsPanel userId={user.id} canManage={has(capabilities, "admin.sessions.manage")} onNotice={setNotice} />}
        {has(capabilities, "admin.subscriptions.read") && <SubscriptionPanel kind="users" id={user.id} canManage={has(capabilities, "admin.subscriptions.manage")} />}
        {has(capabilities, "admin.calls.read") && <UserCallsPanel user={user} />}
      </section>
    </div>
  </section>;
}

function UserFacts({ user }: { user: UserResponse }) {
  return <dl><dt>Роль</dt><dd>{roleLabel(user.role)}</dd><dt>Имя пользователя</dt><dd>{user.username}</dd><dt>Должность</dt><dd>{user.post || "Не указана"}</dd><dt>Телефон</dt><dd>{user.phone || "Не указан"}</dd><dt>Часовой пояс</dt><dd>{user.timezone || "Не указан"}</dd><dt>Создан</dt><dd>{date(user.created_at)}</dd></dl>;
}

function ProfileEditor({ user, onSaved, onNotice }: { user: UserResponse; onSaved: (user: UserResponse) => void; onNotice: (notice: string) => void }) {
  const [values, setValues] = useState({ full_name: user.full_name, full_surname: user.full_surname, username: user.username, post: user.post ?? "", phone: user.phone ?? "", timezone: user.timezone ?? "", reason: "" });
  const [busy, setBusy] = useState(false);
  function setField(field: keyof typeof values, value: string) { setValues((current) => ({ ...current, [field]: value })); }
  async function save() {
    const changed: Partial<UpdateAdminUserProfileRequest> = {};
    (["full_name", "full_surname", "username", "post", "phone", "timezone"] as const).forEach((field) => {
      const value = values[field].trim();
      if (value && value !== (user[field] ?? "")) changed[field] = value;
    });
    if (!Object.keys(changed).length) return onNotice("Измените хотя бы одно поле профиля");
    if (!values.reason.trim()) return onNotice("Укажите причину изменения профиля");
    if (("full_name" in changed && !changed.full_name) || ("full_surname" in changed && !changed.full_surname)) return onNotice("Имя и фамилия не могут быть пустыми");
    setBusy(true);
    try {
      onSaved(await api.updateAdminUserProfile(user.id, { ...changed, reason: values.reason.trim() }));
      setValues((current) => ({ ...current, reason: "" }));
      onNotice("Профиль обновлён");
    } catch (error) {
      onNotice(error instanceof ApiError && error.code === "user_already_exists" ? "Этот username уже занят" : message(error));
    } finally { setBusy(false); }
  }
  return <div className="admin-action-block"><h3>Редактировать профиль</h3><div className="admin-form-grid">
    <label>Имя<input value={values.full_name} onChange={(event) => setField("full_name", event.target.value)} /></label><label>Фамилия<input value={values.full_surname} onChange={(event) => setField("full_surname", event.target.value)} /></label>
    <label>Username<input value={values.username} onChange={(event) => setField("username", event.target.value)} /></label><label>Должность<input value={values.post} onChange={(event) => setField("post", event.target.value)} /></label>
    <label>Телефон<input value={values.phone} onChange={(event) => setField("phone", event.target.value)} /></label><label>Часовой пояс<input value={values.timezone} onChange={(event) => setField("timezone", event.target.value)} /></label>
  </div><label>Причина<textarea value={values.reason} onChange={(event) => setField("reason", event.target.value)} placeholder="Обязательна для аудита" /></label><button className="primary-button small" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Сохраняю…" : "Сохранить профиль"}</button></div>;
}

function RoleEditor({ user, capabilities, onSaved, onNotice }: { user: UserResponse; capabilities: AdminCapabilitiesResponse; onSaved: (user: UserResponse) => void; onNotice: (notice: string) => void }) {
  const options = availableRoleTargets(capabilities).filter((role) => role !== user.role);
  const [role, setRole] = useState(options[0] ?? "user");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!options.length) return null;
  async function save() {
    if (!reason.trim()) return onNotice("Укажите причину изменения роли");
    setBusy(true);
    try {
      onSaved(await api.changeAdminUserRole(user.id, { role, expected_role: user.role, reason: reason.trim() }));
      setReason(""); onNotice("Роль пользователя обновлена");
    } catch (error) {
      if (error instanceof ApiError && error.code === "admin_user_role_changed") {
        try { onSaved(await api.getAdminUser(user.id)); } catch { /* The conflict message remains actionable even if reload fails. */ }
        onNotice("Роль изменилась в другой вкладке. Карточка обновлена.");
      } else onNotice(message(error));
    } finally { setBusy(false); }
  }
  return <div className="admin-action-block"><h3>Изменить роль</h3><label>Новая роль<SelectControl value={role} onChange={(event) => setRole(event.target.value)}>{options.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}</SelectControl></label><label>Причина<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Обязательна для аудита" /></label><button className="primary-button small" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Сохраняю…" : "Сохранить роль"}</button></div>;
}

function SessionsPanel({ userId, canManage, onNotice }: { userId: string; canManage: boolean; onNotice: (notice: string) => void }) {
  const [sessions, setSessions] = useState<UserSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [pending, setPending] = useState<{ id?: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; api.listAdminUserSessions(userId).then((result) => { if (alive) setSessions(result.sessions); }).catch((error) => { if (!alive) return; if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { setAvailable(false); return; } onNotice(message(error)); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [userId]);
  async function revoke() {
    if (!pending || !reason.trim()) return onNotice("Укажите причину завершения сессии");
    setBusy(true);
    try {
      if (pending.id) await api.revokeAdminUserSession(userId, pending.id, reason.trim()); else await api.revokeAllAdminUserSessions(userId, reason.trim());
      setSessions((items) => pending.id ? items.filter((item) => item.id !== pending.id) : []);
      setPending(null); setReason(""); onNotice("Сессии пользователя завершены");
    } catch (error) { onNotice(message(error)); } finally { setBusy(false); }
  }
  if (!available) return null;
  return <div className="admin-action-block"><h3>Сессии</h3>{loading ? <p className="admin-session-summary">Загрузка сессий…</p> : sessions.length ? <ul className="admin-sessions">{sessions.map((item) => <li key={item.id}><span><strong>{item.current ? "Текущая сессия" : "Сессия"}</strong><small>{item.user_agent || "Устройство не определено"} · {item.ip || "IP скрыт"}<br />{date(item.last_seen_at || item.created_at)}</small></span>{canManage && <button className="ghost-button small" type="button" onClick={() => setPending({ id: item.id, label: "Завершить сессию" })}>Завершить</button>}</li>)}</ul> : <p className="admin-session-summary">Активных сессий нет</p>}{canManage && sessions.length > 0 && <button className="admin-session-danger" type="button" onClick={() => setPending({ label: "Завершить все сессии" })}>Завершить все сессии</button>}{pending && <ReasonDialog title={pending.label} busy={busy} reason={reason} onReason={setReason} onCancel={() => setPending(null)} onConfirm={() => void revoke()} />}</div>;
}

function CompanyDetail({ company, capabilities, currentUserId, onBack, onUpdated }: { company: CompanyResponse; capabilities: AdminCapabilitiesResponse; currentUserId: string; onBack: () => void; onUpdated: (company: CompanyResponse) => void }) {
  const [notice, setNotice] = useState("");
  const canEditTag = company.manager_user_uuid === currentUserId;
  const [tag, setTag] = useState(company.tag ?? "");
  const [busy, setBusy] = useState(false);
  async function saveTag() {
    if (!tag.trim()) return setNotice("Введите тег компании");
    setBusy(true);
    try { onUpdated(await api.updateCompanyTag(company.id, tag)); setNotice("Тег компании обновлён"); } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  return <section className="admin-page admin-user-page"><button className="text-button" type="button" onClick={onBack}>← К компаниям</button><header className="admin-page-head"><div><p className="eyebrow">КАРТОЧКА КОМПАНИИ</p><h1>{company.name}</h1><p>{company.tag || "Тег не задан"}</p></div><span className="admin-avatar">{company.name.slice(0, 2).toUpperCase()}</span></header>{notice && <p className="admin-notice" role="status">{notice}</p>}<div className="admin-profile-grid"><section className="admin-detail"><h2>Компания</h2><dl><dt>Тег</dt><dd>{company.tag || "Тег не задан"}</dd><dt>Создана</dt><dd>{date(company.created_at)}</dd><dt>Лимит участников</dt><dd>{company.member_limit}</dd></dl>{canEditTag && <div className="admin-action-block"><h3>Изменить тег</h3><label>Тег<input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="@calllens_team" /></label><button className="primary-button small" type="button" disabled={busy} onClick={() => void saveTag()}>{busy ? "Сохраняю…" : "Сохранить тег"}</button></div>}</section><section className="admin-detail">{has(capabilities, "admin.subscriptions.read") && <SubscriptionPanel kind="companies" id={company.id} canManage={has(capabilities, "admin.subscriptions.manage")} />}</section></div></section>;
}

function SubscriptionPanel({ kind, id, canManage }: { kind: SubscriptionOwner; id: string; canManage: boolean }) {
  const [subscription, setSubscription] = useState<AdminSubscriptionResponse | null>(null);
  const [status, setStatus] = useState("Загрузка…");
  const [available, setAvailable] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planCode, setPlanCode] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; Promise.all([api.getAdminSubscription(kind, id), api.listPlans()]).then(([current, allPlans]) => { if (!alive) return; setSubscription(current); setStatus(""); const allowed = allPlans.plans.filter((plan) => plan.type === (kind === "users" ? "personal" : "business")); setPlans(allowed); setPlanCode(allowed[0]?.code ?? ""); }).catch((error) => { if (!alive) return; if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { setAvailable(false); return; } setStatus(error instanceof ApiError && error.code === "subscription_not_found" ? "Активной подписки нет" : message(error)); api.listPlans().then((response) => { if (alive) { const allowed = response.plans.filter((plan) => plan.type === (kind === "users" ? "personal" : "business")); setPlans(allowed); setPlanCode(allowed[0]?.code ?? ""); } }).catch(() => undefined); }); return () => { alive = false; }; }, [id, kind]);
  async function grant() { if (!planCode || !endsAt || !reason.trim()) return; setBusy(true); try { const updated = await api.grantAdminSubscription(kind, id, { plan_code: planCode as Plan["code"], ends_at: new Date(`${endsAt}T23:59:59`).toISOString(), reason: reason.trim() }); setSubscription(updated); setStatus(""); setReason(""); } catch (error) { setStatus(message(error)); } finally { setBusy(false); } }
  async function cancel() { if (!reason.trim()) return setStatus("Укажите причину отмены"); setBusy(true); try { const updated = await api.cancelAdminSubscription(kind, id, reason.trim()); setSubscription(updated); setReason(""); } catch (error) { setStatus(message(error)); } finally { setBusy(false); } }
  const subscriptionPlanName = subscription ? plans.find((plan) => plan.code === subscription.plan_code)?.name ?? subscription.plan_code : "";
  if (!available) return null;
  return <div className="admin-subscription"><strong>Подписка</strong><p>{subscription ? `${subscriptionPlanName} · ${subscription.status}` : status}</p>{subscription?.ends_at && <small>Действует до {date(subscription.ends_at)}</small>}{canManage && <><label>Тариф<SelectControl value={planCode} onChange={(event) => setPlanCode(event.target.value)}>{plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}</SelectControl></label><label>Дата окончания<input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label><label>Причина<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Обязательна для аудита" /></label><div className="admin-button-row"><button className="primary-button small" type="button" disabled={busy || !planCode || !endsAt || !reason.trim()} onClick={() => void grant()}>{subscription ? "Продлить / выдать" : "Выдать подписку"}</button>{subscription && <button className="ghost-button small" type="button" disabled={busy || !reason.trim()} onClick={() => void cancel()}>Отменить</button>}</div></>}</div>;
}

function UserCallsPanel({ user }: { user: UserResponse }) {
  const [open, setOpen] = useState(false); const [calls, setCalls] = useState<CallResponse[]>([]); const [selectedCall, setSelectedCall] = useState<CallResponse | null>(null); const [loading, setLoading] = useState(false); const [notice, setNotice] = useState("");
  async function loadCalls() { setOpen(true); setLoading(true); setNotice(""); try { const response = await api.listAdminUserCalls(user.id, { limit: 50, offset: 0 }); setCalls(response.items); setSelectedCall((current) => current ? response.items.find((call) => call.id === current.id) ?? null : null); } catch (error) { if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { setOpen(false); return; } setNotice(message(error)); } finally { setLoading(false); } }
  if (!open) return <div className="admin-action-block"><h3>Звонки</h3><button className="ghost-button small" type="button" onClick={() => void loadCalls()}>Звонки пользователя</button></div>;
  return <div className="admin-action-block"><div className="admin-panel-head"><h3>Звонки пользователя</h3><button className="ghost-button small" type="button" disabled={loading} aria-busy={loading} onClick={() => void loadCalls()}><RefreshCw className={loading ? "refresh-icon spinning" : "refresh-icon"} size={14} />Обновить</button></div>{loading && calls.length === 0 ? <p className="admin-session-summary">Загрузка звонков…</p> : notice ? <p className="admin-notice">{notice}</p> : calls.length === 0 ? <p className="admin-session-summary">Звонков пока нет</p> : <ul className="admin-calls" aria-busy={loading}>{calls.map((call) => <li key={call.id}><button type="button" className={selectedCall?.id === call.id ? "active" : ""} onClick={() => setSelectedCall(call)}><span><strong>{call.title}</strong><small>{date(call.created_at)} · {callStatusLabel(call.status)}</small></span><Headphones size={16} /></button></li>)}</ul>}{selectedCall && <div className="admin-call-card"><h2>{selectedCall.title}</h2><p>{date(selectedCall.created_at)} · {callStatusLabel(selectedCall.status)}</p><AdminMediaPlayer call={selectedCall} /></div>}</div>;
}

function AdminMediaPlayer({ call }: { call: CallResponse }) {
  const [url, setUrl] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { let alive = true; let objectUrl = ""; setUrl(""); setError(""); setLoading(true); getAdminCallAudioBlob(call.id).then((blob) => { if (!alive) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch((loadError) => { if (alive) setError(loadError instanceof ApiError && loadError.code === "audio_file_not_found" ? "Файл записи недоступен" : message(loadError)); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [call.id]);
  if (loading) return <p className="admin-session-summary">Загрузка записи…</p>; if (error) return <p className="admin-notice">{error}</p>; return isVideoCall(call) ? <video className="admin-media" controls src={url} /> : <audio className="admin-audio" controls src={url} />;
}

function UserAvatar({ user }: { user: UserResponse }) {
  return <span className={`admin-avatar ${user.avatar_url ? "has-image" : ""}`} aria-label={`Аватар пользователя ${fullName(user)}`}>{user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{initials(user)}</span>}</span>;
}

function ReasonDialog({ title, reason, busy, onReason, onCancel, onConfirm }: { title: string; reason: string; busy: boolean; onReason: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="confirm-dialog-layer" role="presentation" onPointerDown={onCancel}><section className="confirm-dialog danger" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(event) => event.stopPropagation()}><div className="confirm-dialog-content"><div className="confirm-dialog-head"><h2>{title}</h2></div><p>Причина обязательна для аудита действия.</p><label className="admin-dialog-field">Причина<input autoFocus value={reason} onChange={(event) => onReason(event.target.value)} /></label><div className="confirm-dialog-actions"><button className="primary-button small danger-confirm" type="button" disabled={busy || !reason.trim()} onClick={onConfirm}>{busy ? "Выполняю…" : "Подтвердить"}</button><button className="ghost-button small" type="button" disabled={busy} onClick={onCancel}>Отмена</button></div></div></section></div>;
}

function UsersTable({ users, onOpen }: { users: UserResponse[]; onOpen: (user: UserResponse) => void }) { return <div className="admin-table-wrap"><table><thead><tr><th>Пользователь</th><th>Роль</th><th>Создан</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{fullName(user)}</strong><small>{user.username} · {user.email}</small></td><td><span className="chip">{roleLabel(user.role)}</span></td><td>{date(user.created_at)}</td><td><button className="ghost-button small" type="button" onClick={() => onOpen(user)}>Открыть</button></td></tr>)}</tbody></table>{users.length === 0 && <p className="admin-empty">Пользователи не найдены</p>}</div>; }
function CompaniesTable({ companies, onOpen }: { companies: CompanyResponse[]; onOpen: (company: CompanyResponse) => void }) { return <div className="admin-table-wrap"><table><thead><tr><th>Компания</th><th>Тег</th><th>Создана</th><th /></tr></thead><tbody>{companies.map((company) => <tr key={company.id}><td><strong>{company.name}</strong></td><td>{company.tag || "Тег не задан"}</td><td>{date(company.created_at)}</td><td><button className="ghost-button small" type="button" onClick={() => onOpen(company)}>Открыть</button></td></tr>)}</tbody></table>{companies.length === 0 && <p className="admin-empty">Компании не найдены</p>}</div>; }

function canTargetRole(actor: AdminCapabilitiesResponse["role"], target: string) { return target !== "superadmin" && (actor === "superadmin" || (actor === "admin" && (target === "user" || target === "helper"))); }
function canChangeRole(capabilities: AdminCapabilitiesResponse, target: string) { if (target === "superadmin") return false; return target === "admin" ? has(capabilities, "admin.roles.manage_admins") : has(capabilities, "admin.roles.manage_helpers"); }
function availableRoleTargets(capabilities: AdminCapabilitiesResponse) { const roles = has(capabilities, "admin.roles.manage_helpers") ? ["user", "helper"] : []; return has(capabilities, "admin.roles.manage_admins") ? [...roles, "admin"] : roles; }
function roleLabel(role: string) { return ({ user: "Пользователь", helper: "Помощник", admin: "Администратор", superadmin: "Супер-администратор" } as Record<string, string>)[role] ?? role; }
function callStatusLabel(status: string) { return ({ new: "Новый", processing: "Обрабатывается", transcribed: "Расшифрован", analyzed: "Проанализирован", failed: "Не обработан" } as Record<string, string>)[status] ?? "Статус неизвестен"; }
function fullName(user: UserResponse) { return `${user.full_name} ${user.full_surname}`.trim() || user.username; }
function initials(user: UserResponse) { return fullName(user).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function date(value: string) { const parsed = new Date(value); return value && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(parsed) : "—"; }
function message(error: unknown) { return error instanceof Error ? error.message : "Не удалось выполнить операцию"; }
