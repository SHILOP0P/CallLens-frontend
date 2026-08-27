import {
  ArrowLeft,
  AppWindow,
  Copy,
  KeyRound,
  Link2,
  PlugZap,
  ScrollText,
  Settings2,
  ShieldCheck,
  UploadCloud,
  UserCog,
  Webhook,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import type {
  CompanyResponse,
  CreatedIntegrationKey,
  DeveloperApplication,
  IntegrationAuditEvent,
  IntegrationConnection,
  IntegrationIngestItem,
  IntegrationServiceAccount,
  IntegrationAPIKey,
  IntegrationWebhook,
  IntegrationWebhookDelivery,
  SessionState,
} from "../../types";
import { SelectControl } from "../../shared/ui/primitives";
import { TransientAlert } from "../../shared/ui/TransientAlert";
import { CustomScrollbar } from "../../shared/ui/custom-scrollbar";

const statusLabels: Record<string, string> = {
  active: "Активно", disabled: "Отключено", revoked: "Отозвано", draft: "Черновик",
  degraded: "Есть ошибки", received: "Получено", processing: "Обрабатывается",
  retry_wait: "Ожидает повтора", failed: "Ошибка", completed: "Завершено",
  cancelled: "Отменено", succeeded: "Доставлено", pending: "Ожидает",
};
const auditLabels: Record<string, string> = {
  "ingest.accepted": "Импорт принят", "ingest.completed": "Импорт завершён",
  "ingest.failed": "Ошибка импорта", "ingest.retry_scheduled": "Назначена повторная обработка", "connection.created": "Подключение создано",
  "connection.updated": "Настройки подключения изменены", "connection.enabled": "Подключение включено",
  "connection.disabled": "Подключение остановлено", "connection.revoked": "Подключение отозвано",
  "service_account.created": "Сервисный аккаунт создан", "service_account.revoked": "Сервисный аккаунт отозван",
  "key.created": "API-ключ выпущен", "key.rotated": "API-ключ заменён", "key.revoked": "API-ключ отозван",
  "webhook.created": "Webhook создан", "webhook.revoked": "Webhook отозван", "webhook.test_queued": "Тестовый webhook поставлен в очередь",
};
const scopeLabels: Record<string, string> = {
  "calls:write": "Загрузка звонков", "calls:read": "Чтение звонков",
  "usage:read": "Просмотр расхода кредитов", "destinations:read": "Просмотр доступных папок",
  "webhooks:read": "Просмотр webhooks", "webhooks:write": "Управление webhooks",
};
const actorLabels: Record<string, string> = { user: "Пользователь", service_account: "Сервисный аккаунт", system: "Система" };
const entityLabels: Record<string, string> = { connection: "Подключение", ingest_item: "Импорт", service_account: "Сервисный аккаунт", api_key: "API-ключ", webhook: "Webhook" };
const placementLabels: Record<string, string> = { connection_default: "Папка подключения", request_override: "Папка из запроса", system_external: "Системная папка «Внешние»" };

function ScopeList({ scopes }: { scopes: string[] }) {
  return <span className="integration-scope-list">{scopes.map((scope) => <span title={scope} key={scope}><ShieldCheck size={13}/>{scopeLabels[scope] ?? scope}</span>)}</span>;
}

function AuditEventEmblem({ type }: { type: string }) {
  const kind = type.split(".")[0];
  const Icon = kind === "ingest" ? UploadCloud : kind === "connection" ? Settings2 : kind === "webhook" ? Webhook : kind === "key" ? KeyRound : kind === "service_account" ? UserCog : ScrollText;
  return <span className={`integration-icon is-audit-event is-${kind}`}><Icon size={17}/></span>;
}

async function copyToClipboard(value: string, onCopied: () => void, onFailed: () => void) {
  try {
    await navigator.clipboard.writeText(value);
    onCopied();
  } catch {
    onFailed();
  }
}

export function IntegrationsPage({
  session,
  companies,
  onBack,
}: {
  session: SessionState;
  companies: CompanyResponse[];
  onBack: () => void;
}) {
  const managed = companies.filter(
    (company) => company.manager_user_uuid === session.user.id,
  );
  const [owner, setOwner] = useState("user");
  const [apps, setApps] = useState<DeveloperApplication[]>([]);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "sandbox",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedIntegrationKey | null>(
    null,
  );
  const [copyMessage, setCopyMessage] = useState("");
  const pageScrollRef = useRef<HTMLElement>(null);
  const [keyApp, setKeyApp] = useState("");
  const [keyName, setKeyName] = useState("Основной ключ");
  const ownerType = owner === "user" ? "user" : "company";
  const ownerId = owner === "user" ? undefined : owner;
  useEffect(() => {
    let alive = true;
    setMessage("");
    api
      .listDeveloperApplications(ownerType, ownerId)
      .then((value) => {
        if (alive) {
          setApps(value.applications);
          setKeyApp(value.applications[0]?.application_uuid ?? "");
        }
      })
      .catch((error) => {
        if (alive)
          setMessage(
            error instanceof ApiError
              ? error.message
              : "Не удалось загрузить приложения.",
          );
      });
    return () => {
      alive = false;
    };
  }, [owner, ownerId, ownerType]);
  async function createApp() {
    if (!name.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const app = await api.createDeveloperApplication({
        owner_type: ownerType,
        owner_uuid: ownerId,
        name: name.trim(),
        environment,
		capabilities: ["calls:write", "calls:read", "usage:read", "destinations:read", "webhooks:read", "webhooks:write"],
        daily_credit_limit: environment === "sandbox" ? 25000 : undefined,
        monthly_credit_limit: environment === "sandbox" ? 100000 : undefined,
        max_credits_per_operation: 250000,
      });
      setApps((current) => [app, ...current]);
      setKeyApp(app.application_uuid);
      setName("");
      setMessage("Приложение создано.");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Не удалось создать приложение.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createKey() {
    if (!keyApp || !keyName.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      setCreatedKey(
        await api.createIntegrationKey(keyApp, {
          name: keyName.trim(),
			scopes: ["calls:write", "calls:read", "usage:read", "destinations:read", "webhooks:read", "webhooks:write"],
        }),
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Не удалось выпустить ключ.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section ref={pageScrollRef} className="integrations-page app-page settings-subpage-layout custom-scroll-target">
      <div className="settings-back-row">
        <button className="ghost-button small" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Назад
        </button>
      </div>
      <header className="app-page-heading settings-heading">
        <span className="settings-heading-icon">
          <PlugZap size={27} />
        </span>
        <div>
          <h1>Интеграции и API</h1>
          <p>
            Отдельные тестовые и рабочие приложения для внешних систем.
          </p>
        </div>
      </header>
      {message && (
        <p className="admin-action-status" role="status">
          {message}
        </p>
      )}
      <div className="integration-grid">
        <section className="glass integration-card">
          <h2>Новое приложение</h2>
          <label>
            Владелец
            <SelectControl
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="user">Личный аккаунт</option>
              {managed.map((company) => (
                <option value={company.id} key={company.id}>
                  {company.name}
                </option>
              ))}
            </SelectControl>
          </label>
          <label>
            Название
            <input
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, тестовый Bitrix24"
            />
          </label>
          <label>
            Окружение
            <SelectControl
              value={environment}
              onChange={(e) =>
                setEnvironment(e.target.value as "sandbox" | "production")
              }
            >
              <option value="sandbox">Тестовая среда — тестовые кредиты</option>
              <option value="production">Рабочая среда — реальные кредиты</option>
            </SelectControl>
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void createApp()}
          >
            {busy ? "Создаю…" : "Создать приложение"}
          </button>
        </section>
        <section className="glass integration-card">
          <h2>Выпустить API-ключ</h2>
          <p className="integration-warning">
            <ShieldCheck size={17} />
            Секрет показывается один раз. После закрытия его нельзя посмотреть
            снова.
          </p>
          <label>
            Приложение
            <SelectControl
              value={keyApp}
              onChange={(e) => setKeyApp(e.target.value)}
            >
              <option value="">Выберите приложение</option>
              {apps.map((app) => (
                <option value={app.application_uuid} key={app.application_uuid}>
                  {app.name} · {app.environment === "sandbox" ? "тестовая среда" : "рабочая среда"}
                </option>
              ))}
            </SelectControl>
          </label>
          <label>
            Название ключа
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </label>
          <button
            className="ghost-button"
            type="button"
            disabled={busy || !keyApp}
            onClick={() => void createKey()}
          >
            <KeyRound size={17} />
            Выпустить ключ
          </button>
        </section>
      </div>
      <section className="glass integration-list">
        <h2 className="integration-title"><span className="integration-icon is-app"><AppWindow size={20}/></span>Приложения</h2>
        {apps.length === 0 ? (
          <p>Приложений пока нет.</p>
        ) : (
          apps.map((app) => (
            <button
              className={`integration-connection-row${keyApp === app.application_uuid ? " active" : ""}`}
              type="button"
              key={app.application_uuid}
              onClick={() => setKeyApp(app.application_uuid)}
            >
              <div className="integration-row-summary">
                <span className="integration-icon is-app"><AppWindow size={17}/></span>
                <span><strong>{app.name}</strong></span>
              </div>
              <span className={`integration-environment ${app.environment}`}>
                {app.environment === "sandbox" ? "Тестовая" : "Рабочая"}
              </span>
              <span>{statusLabels[app.status] ?? app.status}</span>
            </button>
          ))
        )}
      </section>
      {keyApp && (
        <ConnectionManager
          application={apps.find((app) => app.application_uuid === keyApp)!}
          busy={busy}
          setBusy={setBusy}
          setMessage={setMessage}
          onApplicationChanged={(updated) => {
            setApps((current) =>
              current.map((app) =>
                app.application_uuid === updated.application_uuid
                  ? updated
                  : app,
              ),
            );
            if (updated.status === "revoked") setKeyApp("");
          }}
        />
      )}
      {createdKey && (
        <div className="integration-secret-backdrop" role="presentation">
          <section
            className="integration-secret-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-key-title"
          >
            <KeyRound size={28} />
            <h2 id="integration-key-title">Сохраните ключ сейчас</h2>
            <p>После закрытия VerbaTrace больше не покажет этот секрет.</p>
            <code>{createdKey.secret}</code>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void copyToClipboard(createdKey.secret, () => { setCopyMessage(""); window.setTimeout(() => setCopyMessage("Ключ скопирован"), 0); }, () => setCopyMessage("Не удалось скопировать ключ"))}
            >
              <Copy size={16} />
              Скопировать
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreatedKey(null)}
            >
              Я сохранил ключ
            </button>
          </section>
        </div>
      )}
      {copyMessage && <TransientAlert message={copyMessage} tone="success" />}
      <CustomScrollbar targetRef={pageScrollRef} alignToViewport />
    </section>
  );
}

function ConnectionManager({
  application,
  busy,
  setBusy,
  setMessage,
  onApplicationChanged,
}: {
  application: DeveloperApplication;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setMessage: (value: string) => void;
  onApplicationChanged: (application: DeveloperApplication) => void;
}) {
  const [items, setItems] = useState<IntegrationConnection[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("Основной API");
	const [allowFolderOverride, setAllowFolderOverride] = useState(false);
  const [hooks, setHooks] = useState<IntegrationWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<IntegrationWebhookDelivery[]>(
    [],
  );
  const [imports, setImports] = useState<IntegrationIngestItem[]>([]);
  const [importsTotal, setImportsTotal] = useState(0);
  const [audit, setAudit] = useState<IntegrationAuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [accounts, setAccounts] = useState<IntegrationServiceAccount[]>([]);
  const [keysByAccount, setKeysByAccount] = useState<
    Record<string, IntegrationAPIKey[]>
  >({});
  const [accountName, setAccountName] = useState("Основной сервис");
  const [accountKey, setAccountKey] = useState<CreatedIntegrationKey | null>(
    null,
  );
  const [hookName, setHookName] = useState("События звонков");
  const [hookURL, setHookURL] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [detailView, setDetailView] = useState<"overview" | "imports" | "audit">("overview");
  const [importsPage, setImportsPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const connection = items.find((item) => item.connection_uuid === selected);
  useEffect(() => {
    let alive = true;
    api
      .listIntegrationConnections(application.application_uuid)
      .then((value) => {
        if (alive) {
          setItems(value.connections);
          setSelected(value.connections[0]?.connection_uuid ?? "");
        }
      })
      .catch(
        (error) =>
          alive &&
          setMessage(
            error instanceof ApiError
              ? error.message
              : "Не удалось загрузить подключения.",
          ),
      );
    return () => {
      alive = false;
    };
  }, [application.application_uuid, setMessage]);
  useEffect(() => {
    let alive = true;
    if (!selected) {
      setHooks([]);
      setDeliveries([]);
      setImports([]);
      setAudit([]);
      setAccounts([]);
      return;
    }
    Promise.allSettled([
      api.listIntegrationWebhooks(selected),
      api.listIntegrationWebhookDeliveries(selected),
      api.listIntegrationIngestItems(selected, { limit: 10, offset: 0 }),
      api.listIntegrationAuditEvents(selected, { limit: 10, offset: 0 }),
      api.listIntegrationServiceAccounts(selected),
    ])
      .then(([webhooks, history, ingest, events, serviceAccounts]) => {
        if (alive) {
          setHooks(webhooks.status === "fulfilled" ? (webhooks.value.webhooks ?? []) : []);
          setDeliveries(history.status === "fulfilled" ? (history.value.deliveries ?? []) : []);
          setImports(ingest.status === "fulfilled" ? (ingest.value.ingest_items ?? []) : []);
          setImportsTotal(ingest.status === "fulfilled" ? ingest.value.total : 0);
          setAudit(events.status === "fulfilled" ? (events.value.audit_events ?? []) : []);
          setAuditTotal(events.status === "fulfilled" ? events.value.total : 0);
          setAccounts(serviceAccounts.status === "fulfilled" ? (serviceAccounts.value.service_accounts ?? []) : []);
          if ([webhooks, history, ingest, events, serviceAccounts].some((result) => result.status === "rejected")) {
            setMessage("Часть данных подключения временно недоступна. Доступные разделы показаны ниже.");
          }
        }
      });
    return () => {
      alive = false;
    };
  }, [selected, setMessage]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    api.listIntegrationIngestItems(selected, { limit: 10, offset: detailView === "imports" ? importsPage * 10 : 0 })
      .then((value) => { if (alive) { setImports(value.ingest_items ?? []); setImportsTotal(value.total); } })
      .catch(() => { if (alive) setMessage("Не удалось загрузить страницу импортов."); });
    return () => { alive = false; };
  }, [detailView, importsPage, selected, setMessage]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    api.listIntegrationAuditEvents(selected, { limit: 10, offset: detailView === "audit" ? auditPage * 10 : 0 })
      .then((value) => { if (alive) { setAudit(value.audit_events ?? []); setAuditTotal(value.total); } })
      .catch(() => { if (alive) setMessage("Не удалось загрузить страницу аудита."); });
    return () => { alive = false; };
  }, [auditPage, detailView, selected, setMessage]);
  useEffect(() => {
    let alive = true;
    if (accounts.length === 0) {
      setKeysByAccount({});
      return;
    }
    Promise.all(
      accounts.map(async (account) => [
        account.service_account_uuid,
        (await api.listServiceAccountKeys(account.service_account_uuid)).keys ?? [],
      ] as const),
    )
      .then((entries) => alive && setKeysByAccount(Object.fromEntries(entries)))
      .catch(
        (error) =>
          alive &&
          setMessage(
            error instanceof ApiError
              ? error.message
              : "Не удалось загрузить метаданные ключей.",
          ),
      );
    return () => {
      alive = false;
    };
  }, [accounts, setMessage]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : "Операция не выполнена.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!name.trim()) return;
    await run(async () => {
      const item = await api.createIntegrationConnection(
        application.application_uuid,
        {
          name: name.trim(),
          provider: "generic_api",
          company_uuid:
            application.owner_type === "company"
              ? application.owner_uuid
              : undefined,
          disable_policy: "pause",
					allow_folder_override: allowFolderOverride,
          settings: { schema_version: 1 },
        },
      );
      setItems((current) => [item, ...current]);
      setSelected(item.connection_uuid);
      setMessage("Подключение создано.");
    });
  }
  async function status(next: "active" | "disabled" | "revoked") {
    if (!connection) return;
    await run(async () => {
      const item = await api.changeIntegrationConnectionStatus(
        connection.connection_uuid,
        next,
        connection.lock_version,
      );
      if (next === "revoked") {
        setItems((current) =>
          current.filter(
            (value) => value.connection_uuid !== connection.connection_uuid,
          ),
        );
        setSelected("");
      } else
        setItems((current) =>
          current.map((value) =>
            value.connection_uuid === item.connection_uuid ? item : value,
          ),
        );
    });
  }
  async function createHook() {
    if (!connection || !hookURL.trim()) return;
    await run(async () => {
      const value = await api.createIntegrationWebhook(
        connection.connection_uuid,
        {
          application_uuid: application.application_uuid,
          name: hookName.trim(),
          url: hookURL.trim(),
          event_types: ["ingest.completed", "ingest.failed"],
        },
      );
      setHooks((current) => [value.webhook, ...current]);
      setHookURL("");
      setSecret(value.signing_secret);
    });
  }
  async function testHook() {
    if (!connection) return;
    await run(async () => {
      await api.testIntegrationWebhook(connection.connection_uuid);
      setMessage("Тестовый webhook поставлен в очередь.");
    });
  }
  async function ingestCommand(
    item: IntegrationIngestItem,
    command: "retry" | "cancel",
  ) {
    await run(async () => {
      const updated =
        command === "retry"
          ? await api.retryIntegrationIngestItem(item.ingest_item_uuid)
          : await api.cancelIntegrationIngestItem(item.ingest_item_uuid);
      setImports((current) =>
        current.map((value) =>
          value.ingest_item_uuid === updated.ingest_item_uuid ? updated : value,
        ),
      );
      setMessage(
        command === "retry" ? "Импорт поставлен на повтор." : "Импорт отменён.",
      );
    });
  }
  async function createAccount() {
    if (!connection || !accountName.trim()) return;
    await run(async () => {
      const account = await api.createIntegrationServiceAccount(
        connection.connection_uuid,
        {
          name: accountName.trim(),
			scopes: application.capabilities,
        },
      );
      setAccounts((current) => [account, ...current]);
      setMessage("Сервисный аккаунт создан.");
    });
  }
  async function createAccountKey(account: IntegrationServiceAccount) {
    await run(async () => {
      const created = await api.createServiceAccountKey(
        account.service_account_uuid,
        {
          name: `${account.name}: основной ключ`,
          scopes: account.scopes,
        },
      );
      setAccountKey(created);
      const metadata = await api.listServiceAccountKeys(
        account.service_account_uuid,
      );
      setKeysByAccount((current) => ({
        ...current,
        [account.service_account_uuid]: metadata.keys,
      }));
    });
  }
  async function revokeAccount(account: IntegrationServiceAccount) {
    if (window.prompt(`Для отзыва введите название: ${account.name}`) !== account.name)
      return;
    await run(async () => {
      await api.revokeIntegrationServiceAccount(account.service_account_uuid);
      setAccounts((current) =>
        current.map((item) =>
          item.service_account_uuid === account.service_account_uuid
            ? { ...item, status: "revoked" }
            : item,
        ),
      );
      setKeysByAccount((current) => ({
        ...current,
        [account.service_account_uuid]: (
          current[account.service_account_uuid] ?? []
        ).map((key) => ({ ...key, revoked_at: new Date().toISOString() })),
      }));
      setMessage("Сервисный аккаунт и его ключи отозваны.");
    });
  }
  async function revokeKey(key: IntegrationAPIKey) {
    if (window.prompt(`Для отзыва введите начало ключа: ${key.prefix}`) !== key.prefix)
      return;
    await run(async () => {
      await api.revokeIntegrationKey(key.key_uuid);
      setKeysByAccount((current) => ({
        ...current,
        [key.service_account_uuid]: (current[key.service_account_uuid] ?? []).map(
          (item) =>
            item.key_uuid === key.key_uuid
              ? { ...item, revoked_at: new Date().toISOString() }
              : item,
        ),
      }));
      setMessage("API-ключ отозван.");
    });
  }
  async function rotateKey(key: IntegrationAPIKey) {
    await run(async () => {
      const created = await api.rotateIntegrationKey(key.key_uuid);
      setAccountKey(created);
      const metadata = await api.listServiceAccountKeys(
        key.service_account_uuid,
      );
      setKeysByAccount((current) => ({
        ...current,
        [key.service_account_uuid]: metadata.keys,
      }));
    });
  }
  async function revokeHook(hook: IntegrationWebhook) {
    if (window.prompt(`Для отзыва введите название: ${hook.name}`) !== hook.name)
      return;
    await run(async () => {
      await api.revokeIntegrationWebhook(hook.webhook_endpoint_uuid);
      setHooks((current) =>
        current.map((item) =>
          item.webhook_endpoint_uuid === hook.webhook_endpoint_uuid
            ? { ...item, status: "revoked" }
            : item,
        ),
      );
      setMessage("Webhook отозван.");
    });
  }
  async function sandboxWallet(mode: "add" | "reset") {
    await run(async () => {
      const result = await api.adjustSandboxWallet(
        application.application_uuid,
        mode,
        mode === "add" ? 25000 : 0,
      );
      setMessage(
        `Тестовый кошелёк: ${result.balance_credits.toLocaleString("ru-RU")} кредитов.`,
      );
    });
  }
  async function applicationStatus(status: "active" | "disabled" | "revoked") {
    await run(async () =>
      onApplicationChanged(
        await api.changeDeveloperApplicationStatus(
          application.application_uuid,
          status,
        ),
      ),
    );
  }
  const importPageCount = Math.max(1, Math.ceil(importsTotal / 10));
  const auditPageCount = Math.max(1, Math.ceil(auditTotal / 10));
  const visibleImports = imports.slice(0, 10);
  if (connection && detailView === "imports") {
    return <section className="glass integration-list integration-detail-page">
      <div className="integration-section-heading"><div><button className="ghost-button small" type="button" onClick={() => { setDetailView("overview"); setImportsPage(0); }}><ArrowLeft size={16}/>К подключению</button><h2 className="integration-title"><span className="integration-icon is-import"><UploadCloud size={20}/></span>Все импорты</h2><p>{connection.name} · всего {importsTotal}</p></div></div>
      {imports.map((item) => <article className={`integration-event-card is-${item.status}`} key={item.ingest_item_uuid}>
        <div className="integration-event-title"><span className="integration-icon is-import"><UploadCloud size={18}/></span><span><strong>{item.title}</strong><small>Создан: {new Date(item.created_at).toLocaleString("ru-RU")} · обновлён: {new Date(item.updated_at).toLocaleString("ru-RU")}</small></span></div>
        <span className={`integration-state is-${item.status}`}>{statusLabels[item.status] ?? item.status}</span>
        <dl className="integration-metadata">
          <div><dt>ID во внешней системе</dt><dd><code>{item.external_call_id}</code></dd></div>
          <div><dt>Источник записи</dt><dd>{item.source_kind === "upload" ? "Загрузка файла" : "Ссылка на файл"}</dd></div>
          <div><dt>Размещение</dt><dd>{placementLabels[item.placement_source ?? ""] ?? "По настройкам подключения"}</dd></div>
          <div><dt>Этап обработки</dt><dd>{statusLabels[item.stage] ?? item.stage}</dd></div>
          <div><dt>Попытки</dt><dd>{item.attempts} из {item.max_attempts}</dd></div>
          {item.error_code && <div><dt>Ошибка</dt><dd>{item.error_message ?? "Описание отсутствует"} <code>{item.error_code}</code></dd></div>}
        </dl>
        <div className="integration-actions">{item.status === "failed" && <button className="ghost-button small" disabled={busy} onClick={() => void ingestCommand(item, "retry")}>Повторить</button>}{["received", "retry_wait", "failed"].includes(item.status) && <button className="ghost-button small danger" disabled={busy} onClick={() => void ingestCommand(item, "cancel")}>Отменить</button>}</div>
      </article>)}
      {imports.length === 0 && <p>Импортов пока нет.</p>}
      {importPageCount > 1 && <nav className="integration-pagination" aria-label="Страницы импортов"><button className="ghost-button small" disabled={importsPage === 0} onClick={() => setImportsPage((page) => page - 1)}>Назад</button><span>Страница {importsPage + 1} из {importPageCount}</span><button className="ghost-button small" disabled={importsPage + 1 >= importPageCount} onClick={() => setImportsPage((page) => page + 1)}>Далее</button></nav>}
    </section>;
  }
  if (connection && detailView === "audit") {
    return <section className="glass integration-list integration-detail-page">
      <div className="integration-section-heading"><div><button className="ghost-button small" type="button" onClick={() => { setDetailView("overview"); setAuditPage(0); }}><ArrowLeft size={16}/>К подключению</button><h2 className="integration-title"><span className="integration-icon is-audit"><ScrollText size={20}/></span>Полный журнал аудита</h2><p>{connection.name} · всего {auditTotal}</p></div></div>
      {audit.map((event) => <article className="integration-event-card" key={event.audit_event_uuid}>
        <div className="integration-event-title"><AuditEventEmblem type={event.event_type}/><span><strong>{auditLabels[event.event_type] ?? "Техническое событие интеграции"}</strong><small>{new Date(event.created_at).toLocaleString("ru-RU")}</small></span></div>
        <dl className="integration-metadata">
          <div><dt>Инициатор</dt><dd>{actorLabels[event.actor_type] ?? event.actor_type}</dd></div>
          <div><dt>Объект</dt><dd>{entityLabels[event.entity_type] ?? event.entity_type}</dd></div>
          <div><dt>Тип события</dt><dd><code>{event.event_type}</code></dd></div>
          {event.request_id && <div><dt>ID запроса</dt><dd><code>{event.request_id}</code></dd></div>}
        </dl>
        {event.metadata && Object.keys(event.metadata).length > 0 && <details className="integration-raw"><summary>Технические данные</summary><pre>{JSON.stringify(event.metadata, null, 2)}</pre></details>}
      </article>)}
      {audit.length === 0 && <p>Событий пока нет.</p>}
      {auditPageCount > 1 && <nav className="integration-pagination" aria-label="Страницы аудита"><button className="ghost-button small" disabled={auditPage === 0} onClick={() => setAuditPage((page) => page - 1)}>Назад</button><span>Страница {auditPage + 1} из {auditPageCount}</span><button className="ghost-button small" disabled={auditPage + 1 >= auditPageCount} onClick={() => setAuditPage((page) => page + 1)}>Далее</button></nav>}
    </section>;
  }
  return (
    <>
      <div className="integration-stack">
        <section className="glass integration-card integration-connections-card">
          <h2>
            <span className="integration-icon is-connection"><Link2 size={19} /></span>
            Подключения
          </h2>
          <div className="integration-connection-form-grid">
            <label className="integration-connection-name">
              Название
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
              />
            </label>
            <label className="integration-checkbox">
              <input
                type="checkbox"
                checked={allowFolderOverride}
                onChange={(event) => setAllowFolderOverride(event.target.checked)}
              />
              <span>
                Разрешить запросам выбирать папку
                <small>Только внутри области этого подключения. Без параметра звонок попадёт в «Внешнюю».</small>
              </span>
            </label>
            <p className="integration-help">Инструкции выбираются для каждого запроса. По умолчанию применяются инструкции папки назначения; передайте <code>instruction_mode: "scope_and_folder"</code>, чтобы добавить инструкции профиля, компании или отдела.</p>
            <button
              className="ghost-button integration-create-connection"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              <Link2 size={17} />
              Создать API
            </button>
          </div>
          <div className="integration-connection-list">
          {items.map((item) => (
            <button
              className={`integration-connection-row${selected === item.connection_uuid ? " active" : ""}`}
              type="button"
              onClick={() => setSelected(item.connection_uuid)}
              key={item.connection_uuid}
            >
              <span className="integration-row-summary">
                <span className="integration-icon is-connection"><Link2 size={17}/></span>
                <span><strong>{item.name}</strong></span>
              </span>
              <span className={`integration-state is-${item.status}`}>
                {statusLabels[item.status] ?? item.status}
              </span>
            </button>
          ))}
          </div>
        </section>
        {connection && (
          <section className="glass integration-card integration-management-card">
            <div className="integration-management-header">
              <h2 className="integration-title"><span className="integration-icon is-management"><Settings2 size={20}/></span>Управление: {connection.name}</h2>
              <div className="integration-actions">
              {connection.status === "active" ? (
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void status("disabled")}
                >
                  Остановить
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void status("active")}
                >
                  Включить
                </button>
              )}
              <button
                className="ghost-button danger"
                disabled={busy}
                onClick={() => void status("revoked")}
              >
                Отозвать
              </button>
              </div>
            </div>
            <div className="integration-webhook-panel">
              <div className="integration-webhook-heading">
                <span className="integration-icon is-management"><Webhook size={19}/></span>
                <span><h2>Webhook</h2><small>Получайте уведомления о событиях звонков на своём сервере</small></span>
              </div>
              <div className="integration-webhook-columns">
                <div className="integration-webhook-column">
                  <label>
                    Название
                    <input
                      value={hookName}
                      onChange={(event) => setHookName(event.target.value)}
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={busy || !hookURL.trim()}
                    onClick={() => void createHook()}
                  >
                    <Webhook size={17} />
                    Добавить webhook
                  </button>
                </div>
                <div className="integration-webhook-column">
                  <label>
                    HTTPS URL
                    <input
                      type="url"
                      value={hookURL}
                      onChange={(event) => setHookURL(event.target.value)}
                      placeholder="https://example.com/webhooks/verbatrace"
                    />
                  </label>
                  <button
                    className="ghost-button"
                    disabled={busy || hooks.length === 0}
                    onClick={() => void testHook()}
                  >
                    Отправить тестовый webhook
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
      {connection && (
        <>
          <section className="glass integration-list">
            <h2 className="integration-title"><span className="integration-icon is-account"><UserCog size={20}/></span>Сервисные аккаунты</h2>
            <div
              className="integration-actions"
              aria-label="Управление приложением"
            >
              {application.status === "active" ? (
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void applicationStatus("disabled")}
                >
                  Отключить приложение
                </button>
              ) : (
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void applicationStatus("active")}
                >
                  Включить приложение
                </button>
              )}
              <button
                className="ghost-button danger"
                disabled={busy}
                onClick={() => void applicationStatus("revoked")}
              >
                Отозвать приложение и ключи
              </button>
            </div>
            <div className="integration-inline-form">
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                maxLength={120}
                aria-label="Название сервисного аккаунта"
              />
              <button
                className="ghost-button"
                disabled={busy || !accountName.trim()}
                onClick={() => void createAccount()}
              >
                Создать
              </button>
              {application.environment === "sandbox" && (
                <>
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => void sandboxWallet("add")}
                  >
                    +25 000 тестовых
                  </button>
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => void sandboxWallet("reset")}
                  >
                    Сбросить тестовый баланс
                  </button>
                </>
              )}
            </div>
            {accounts.map((account) => (
              <article className="integration-account-block" key={account.service_account_uuid}>
                <div className="integration-account-summary">
                  <span className="integration-icon is-account"><UserCog size={19}/></span>
                  <span><strong>{account.name}</strong><small>Сервисный аккаунт для запросов к API</small></span>
                </div>
                <span className={`integration-state is-${account.status}`}>
                  {statusLabels[account.status] ?? account.status}
                </span>
                <button
                  className="ghost-button small"
                  disabled={busy || account.status !== "active"}
                  onClick={() => void createAccountKey(account)}
                >
                  Выпустить ключ
                </button>
                <button
                  className="ghost-button small danger"
                  disabled={busy || account.status !== "active"}
                  onClick={() => void revokeAccount(account)}
                >
                  Отозвать сервисный аккаунт
                </button>
                <div className="integration-key-list">
                  <div className="integration-permissions"><span>Разрешения</span><ScopeList scopes={account.scopes} /></div>
                  {(keysByAccount[account.service_account_uuid] ?? []).map(
                    (key) => (
                      <div className="integration-key-row" key={key.key_uuid}>
                        <span className="integration-key-summary">
                          <span className="integration-icon is-key"><KeyRound size={17}/></span>
                          <span><strong>{key.name.replace(/\s+key$/i, "")}</strong><small>API-ключ</small></span>
                        </span>
                        <span className={`integration-state is-${key.revoked_at ? "revoked" : "active"}`}>
                          {key.revoked_at ? "Отозван" : "Активен"}
                        </span>
                        {!key.revoked_at && (
                          <div className="integration-actions">
                            <button className="ghost-button small" disabled={busy} onClick={() => void rotateKey(key)}>
                              Заменить ключ
                            </button>
                            <button className="ghost-button small danger" disabled={busy} onClick={() => void revokeKey(key)}>
                              Отозвать
                            </button>
                          </div>
                        )}
                        <dl className="integration-key-metadata">
                          <div><dt>Начало ключа</dt><dd><code>{key.prefix}</code></dd></div>
                          <div><dt>Последнее использование</dt><dd>{key.last_used_at ? new Date(key.last_used_at).toLocaleString("ru-RU") : "Ещё не использовался"}</dd></div>
                          <div><dt>Создан</dt><dd>{new Date(key.created_at).toLocaleString("ru-RU")}</dd></div>
                        </dl>
                      </div>
                    ),
                  )}
                </div>
              </article>
            ))}
            {accounts.length === 0 && <p>Сервисных аккаунтов пока нет.</p>}
          </section>
          <section className="glass integration-list">
            <div className="integration-section-heading"><div><h2 className="integration-title"><span className="integration-icon is-import"><UploadCloud size={20}/></span>Последние импорты</h2><p>Последние 10 запросов на загрузку звонков</p></div>{importsTotal > 0 && <button className="ghost-button small" type="button" onClick={() => { setDetailView("imports"); setImportsPage(0); }}>Все импорты</button>}</div>
            {visibleImports.map((item) => (
              <article key={item.ingest_item_uuid}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    ID во внешней системе: <code>{item.external_call_id}</code> · {new Date(item.created_at).toLocaleString("ru-RU")}
                    {item.error_code ? ` · Ошибка: ${item.error_code}` : ""}
                  </small>
                </div>
                <span className={`integration-state is-${item.status}`}>
                  {statusLabels[item.status] ?? item.status}
                </span>
                <div className="integration-actions">
                  {item.status === "failed" && (
                    <button
                      className="ghost-button small"
                      disabled={busy}
                      onClick={() => void ingestCommand(item, "retry")}
                    >
                      Повторить
                    </button>
                  )}
                  {["received", "retry_wait", "failed"].includes(
                    item.status,
                  ) && (
                    <button
                      className="ghost-button small danger"
                      disabled={busy}
                      onClick={() => void ingestCommand(item, "cancel")}
                    >
                      Отменить
                    </button>
                  )}
                </div>
              </article>
            ))}
            {imports.length === 0 && <p>Импортов пока нет.</p>}
          </section>
          <section className="glass integration-list">
            <h2>Webhooks и доставки</h2>
            {hooks.map((hook) => (
              <article key={hook.webhook_endpoint_uuid}>
                <div>
                  <strong>{hook.name}</strong>
                  <small>{hook.event_types.join(" · ")}</small>
                </div>
                <span>{statusLabels[hook.status] ?? hook.status}</span>
                {hook.status !== "revoked" && (
                  <button className="ghost-button small danger" disabled={busy} onClick={() => void revokeHook(hook)}>
                    Отозвать
                  </button>
                )}
              </article>
            ))}
            {deliveries.slice(0, 10).map((delivery) => (
              <article key={delivery.delivery_uuid}>
                <div>
                  <strong>Попытка #{delivery.attempt}</strong>
                  <small>
                    {new Date(delivery.created_at).toLocaleString("ru-RU")} ·
                    HTTP {delivery.http_status ?? "—"}
                  </small>
                </div>
                <span className={`integration-state is-${delivery.status}`}>
                  {statusLabels[delivery.status] ?? delivery.status}
                </span>
              </article>
            ))}
            {hooks.length === 0 && deliveries.length === 0 && (
              <p>Webhook ещё не настроен.</p>
            )}
          </section>
          <section className="glass integration-list">
            <div className="integration-section-heading"><div><h2 className="integration-title"><span className="integration-icon is-audit"><ScrollText size={20}/></span>Аудит</h2><p>Последние 10 изменений и действий интеграции</p></div>{auditTotal > 0 && <button className="ghost-button small" type="button" onClick={() => { setDetailView("audit"); setAuditPage(0); }}>Полный журнал</button>}</div>
            {audit.slice(0, 10).map((event) => (
              <article key={event.audit_event_uuid}>
                <div className="integration-event-title">
                  <AuditEventEmblem type={event.event_type}/>
                  <span><strong>{auditLabels[event.event_type] ?? "Техническое событие интеграции"}</strong><small>{new Date(event.created_at).toLocaleString("ru-RU")} · {actorLabels[event.actor_type] ?? event.actor_type} · {entityLabels[event.entity_type] ?? event.entity_type}</small></span>
                </div>
              </article>
            ))}
            {audit.length === 0 && <p>Событий пока нет.</p>}
          </section>
        </>
      )}
      {accountKey && (
        <div className="integration-secret-backdrop">
          <section
            className="integration-secret-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-key-title"
          >
            <KeyRound size={28} />
            <h2 id="service-key-title">Сохраните API-ключ</h2>
            <p>
              Ключ показывается один раз. Другой сотрудник не сможет посмотреть
              его позже.
            </p>
            <code>{accountKey.secret}</code>
            <button
              className="ghost-button"
              onClick={() => void copyToClipboard(accountKey.secret, () => { setCopyMessage(""); window.setTimeout(() => setCopyMessage("Ключ скопирован"), 0); }, () => setCopyMessage("Не удалось скопировать ключ"))}
            >
              <Copy size={16} />
              Скопировать
            </button>
            <button
              className="primary-button"
              onClick={() => setAccountKey(null)}
            >
              Я сохранил ключ
            </button>
          </section>
        </div>
      )}
      {secret && (
        <div className="integration-secret-backdrop">
          <section
            className="integration-secret-dialog"
            role="dialog"
            aria-modal="true"
          >
            <Webhook size={28} />
            <h2>Сохраните секрет подписи</h2>
            <p>После закрытия его нельзя посмотреть снова.</p>
            <code>{secret}</code>
            <button
              className="ghost-button"
              onClick={() => void copyToClipboard(secret, () => { setCopyMessage(""); window.setTimeout(() => setCopyMessage("Секрет скопирован"), 0); }, () => setCopyMessage("Не удалось скопировать секрет"))}
            >
              <Copy size={16} />
              Скопировать
            </button>
            <button className="primary-button" onClick={() => setSecret(null)}>
              Я сохранил секрет
            </button>
          </section>
        </div>
      )}
      {copyMessage && <TransientAlert message={copyMessage} tone="success" />}
    </>
  );
}
