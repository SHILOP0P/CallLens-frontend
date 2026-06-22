import {
  Check,
  ShieldCheck,
  X
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type {
  CompanyResponse,
  Plan,
  PlanCode,
  SessionState,
  Subscription
} from "../../types";

import { analysisLevelLabel, availabilityLabel, comparePlans, formatHistoryDays, formatInstructionLimit, formatMinutesLimit, formatNullableLimit, planGradients } from "../../shared/lib/plans";
import { SkeletonLine, TextBlockSkeleton } from "../../shared/ui/loading";
import { SelectControl } from "../../shared/ui/primitives";

export function TariffsPage({
  session,
  companies
}: {
  session: SessionState;
  companies: CompanyResponse[];
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companySubscriptions, setCompanySubscriptions] = useState<Record<string, Subscription>>({});

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
      } catch (loadError) {
        if (!cancelled) {
          const endpointHint =
            loadError instanceof ApiError && loadError.status === 404
              ? " Endpoint GET /api/v1/plans пока недоступен."
              : "";
          setError(`Не удалось загрузить тарифы.${endpointHint}`);
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

  return (
    <section className="tariffs-layout">
      <div className="tariff-hero glass">
        <h1>Тарифы</h1>
        <p>Доступные планы загружаются из backend. Реальная оплата в MVP пока не подключена.</p>
      </div>
      {loading && <TariffSkeleton />}
      {!loading && error && <div className="form-error tariff-message">{error}</div>}
      {!loading && !error && plans.length === 0 && (
        <div className="empty-panel glass">Тарифы пока не настроены.</div>
      )}
      {!loading && !error && plans.length > 0 && (
        <>
          <PersonalSubscriptionPanel personalPlans={personalPlans} />
          <CompanySubscriptionPanel
            session={session}
            companies={companies}
            businessPlans={businessPlans}
            subscriptions={companySubscriptions}
            onSubscriptionChanged={(subscription) => {
              if (!subscription.company_uuid) return;
              setCompanySubscriptions((current) => ({
                ...current,
                [subscription.company_uuid as string]: subscription
              }));
            }}
          />
          <TariffSection title="Персональные тарифы" plans={personalPlans} />
          <TariffSection title="Бизнес-тарифы" plans={businessPlans} business />
        </>
      )}
    </section>
  );
}

export function PersonalSubscriptionPanel({ personalPlans }: { personalPlans: Plan[]; }) {
  const defaultPlanCode = personalPlans[0]?.code ?? "personal_plus";
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(defaultPlanCode);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedPlan(defaultPlanCode);
  }, [defaultPlanCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      try {
        setLoading(true);
        setError("");
        const response = await api.getSubscription();
        if (!cancelled) setSubscription(response);
      } catch (loadError) {
        if (cancelled) return;
        if (
          loadError instanceof ApiError &&
          (loadError.status === 404 || loadError.code === "subscription_not_found")
        ) {
          setSubscription(null);
        } else {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить подписку");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await api.activateSubscription(selectedPlan);
      setSubscription(response);
      setMessage("Персональная подписка активирована.");
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Не удалось активировать подписку");
    } finally {
      setBusy(false);
    }
  }

  const active = subscription?.status === "active";

  return (
    <section className="subscription-panel glass">
      <div className="panel-heading large">
        <div>
          <h2>Персональная подписка</h2>
          <p>Mock-активация личного тарифа через backend без платежной формы.</p>
        </div>
        <span className="status-chip warn">Mock</span>
      </div>
      <div className="subscription-company">
        <div>
          <strong>{subscription?.plan.name ?? "Личный тариф"}</strong>
          <small>
            {loading
              ? "Загружаю текущую подписку..."
              : active
                ? "Подписка привязана к вашему аккаунту."
                : "Можно активировать personal_start, personal_plus или personal_pro."}
          </small>
        </div>
        <SelectControl
          value={selectedPlan}
          onChange={(event) => setSelectedPlan(event.target.value as PlanCode)}
          disabled={busy || personalPlans.length === 0}
        >
          {personalPlans.length === 0 ? (
            <option value="personal_plus">Personal Plus</option>
          ) : (
            personalPlans.map((plan) => (
              <option key={plan.id} value={plan.code}>
                {plan.name}
              </option>
            ))
          )}
        </SelectControl>
        <span className={`status-chip ${active ? "ok" : "warn"}`}>
          {active ? "Активна" : subscription?.status === "canceled" ? "Отменена" : "Не активирована"}
        </span>
        <div className="subscription-actions">
          <button
            type="button"
            className="primary-button small"
            onClick={activate}
            disabled={busy || loading || personalPlans.length === 0}
          >
            <ShieldCheck size={16} />
            {busy ? "Сохраняю..." : active ? "Сменить тариф" : "Активировать подписку"}
          </button>
        </div>
      </div>
      {message && <div className="form-success tariff-message">{message}</div>}
      {error && <div className="form-error tariff-message">{error}</div>}
    </section>
  );
}

export function CompanySubscriptionPanel({
  session,
  companies,
  businessPlans,
  subscriptions,
  onSubscriptionChanged
}: {
  session: SessionState;
  companies: CompanyResponse[];
  businessPlans: Plan[];
  subscriptions: Record<string, Subscription>;
  onSubscriptionChanged: (subscription: Subscription) => void;
}) {
  const managedCompanies = companies.filter((company) => company.manager_user_uuid === session.user.id);
  const defaultPlanCode = businessPlans[0]?.code ?? "business_start";
  const [selectedPlans, setSelectedPlans] = useState<Record<string, PlanCode>>({});
  const [busyCompanyId, setBusyCompanyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (managedCompanies.length === 0) {
    return null;
  }

  async function activate(companyId: string) {
    setBusyCompanyId(companyId);
    setMessage("");
    setError("");

    try {
      const subscription = await api.activateCompanySubscription(
        companyId,
        selectedPlans[companyId] ?? defaultPlanCode
      );
      onSubscriptionChanged(subscription);
      setMessage("Подписка активирована.");
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Не удалось активировать подписку");
    } finally {
      setBusyCompanyId("");
    }
  }

  async function cancel(companyId: string) {
    setBusyCompanyId(companyId);
    setMessage("");
    setError("");

    try {
      const subscription = await api.cancelCompanySubscription(companyId);
      onSubscriptionChanged(subscription);
      setMessage("Подписка отменена.");
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Не удалось отменить подписку");
    } finally {
      setBusyCompanyId("");
    }
  }

  return (
    <section className="subscription-panel glass">
      <div className="panel-heading large">
        <div>
          <h2>Бизнес-подписка компании</h2>
          <p>Временная mock-активация без оплаты и платежных форм.</p>
        </div>
        <span className="status-chip warn">Mock</span>
      </div>
      <div className="subscription-company-list">
        {managedCompanies.map((company) => {
          const subscription = subscriptions[company.id];
          const active = subscription?.status === "active";
          const selectedPlan = selectedPlans[company.id] ?? defaultPlanCode;

          return (
            <div className="subscription-company" key={company.id}>
              <div>
                <strong>{company.name}</strong>
                <small>{subscription?.plan.name ?? "Бизнес-тариф не выбран"}</small>
              </div>
              <SelectControl
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlans((current) => ({
                    ...current,
                    [company.id]: event.target.value as PlanCode
                  }))
                }
                disabled={busyCompanyId === company.id || businessPlans.length === 0}
              >
                {businessPlans.length === 0 ? (
                  <option value="business_start">Business Start</option>
                ) : (
                  businessPlans.map((plan) => (
                    <option key={plan.id} value={plan.code}>
                      {plan.name}
                    </option>
                  ))
                )}
              </SelectControl>
              <span className={`status-chip ${active ? "ok" : "warn"}`}>
                {active ? "Активна" : subscription?.status === "canceled" ? "Отменена" : "Не активирована"}
              </span>
              <div className="subscription-actions">
                <button
                  type="button"
                  className="primary-button small"
                  onClick={() => activate(company.id)}
                  disabled={busyCompanyId === company.id}
                >
                  <ShieldCheck size={16} />
                  {busyCompanyId === company.id ? "Сохраняю..." : "Активировать подписку"}
                </button>
                {active && (
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => cancel(company.id)}
                    disabled={busyCompanyId === company.id}
                  >
                    <X size={16} />
                    Отменить подписку
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {message && <div className="form-success tariff-message">{message}</div>}
      {error && <div className="form-error tariff-message">{error}</div>}
    </section>
  );
}

export function TariffSection({
  title,
  plans,
  business
}: {
  title: string;
  plans: Plan[];
  business?: boolean;
}) {
  if (plans.length === 0) {
    return (
      <section className="tariff-section">
        <h2>{title}</h2>
        <div className="empty-panel glass">Тарифы пока не настроены.</div>
      </section>
    );
  }

  return (
    <section className="tariff-section">
      <h2>{title}</h2>
      <div className="tariff-grid">
        {plans.map((plan) => (
          <TariffCard key={plan.id} plan={plan} business={business} />
        ))}
      </div>
    </section>
  );
}

export function TariffCard({ plan, business }: { plan: Plan; business?: boolean; }) {
  const cardStyle = {
    "--tariff-card-gradient": planGradients[plan.code]
  } as CSSProperties;
  const activeInstructionLimit =
    business ? plan.instructions_per_department_limit ?? plan.active_instruction_limit : plan.active_instruction_limit;
  const features = [
    `Минут в месяц: ${formatMinutesLimit(plan.monthly_minutes_limit)}`,
    `Активных инструкций: ${formatInstructionLimit(activeInstructionLimit)}`,
    business ? `Компаний: ${formatNullableLimit(plan.company_limit)}` : "",
    business ? `Отделов на компанию: ${formatNullableLimit(plan.departments_per_company_limit)}` : "",
    business ? `Сотрудников на компанию: ${formatNullableLimit(plan.members_per_company_limit)}` : "",
    `Уровень анализа: ${analysisLevelLabel(plan.analysis_level)}`,
    `Хранение истории: ${formatHistoryDays(plan.history_retention_days)}`,
    `Экспорт отчетов: ${availabilityLabel(plan.export_enabled)}`,
    business ? `Командная аналитика: ${availabilityLabel(plan.team_analytics_enabled)}` : "",
    business ? `Доступ к API: ${availabilityLabel(plan.api_access_enabled)}` : ""
  ].filter(Boolean);

  return (
    <article className="tariff-card glass" style={cardStyle} data-reveal-item>
      <div className="tariff-card-head">
        <span className="status-chip warn">{plan.type === "personal" ? "Персональный" : "Бизнес"}</span>
        <h3>{plan.name}</h3>
      </div>
      <ul className="tariff-feature-list">
        {features.map((feature) => (
          <li key={feature}>
            <Check size={16} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button className="ghost-button wide" disabled>
        Скоро
      </button>
    </article>
  );
}

export function TariffSkeleton() {
  return (
    <>
      <section className="tariff-section">
        <h2>Персональные тарифы</h2>
        <div className="tariff-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="tariff-card glass skeleton-card" key={index}>
              <SkeletonLine className="button" />
              <SkeletonLine className="title" />
              <TextBlockSkeleton rows={5} />
              <SkeletonLine className="button" />
            </div>
          ))}
        </div>
      </section>
      <section className="tariff-section">
        <h2>Бизнес-тарифы</h2>
        <div className="tariff-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="tariff-card glass skeleton-card" key={index}>
              <SkeletonLine className="button" />
              <SkeletonLine className="title" />
              <TextBlockSkeleton rows={7} />
              <SkeletonLine className="button" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
