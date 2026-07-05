import {
  ChevronRight,
  CloudUpload,
  MoreVertical,
  Play
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CallFilterOptionsResponse,
  CompanyResponse,
  DepartmentResponse,
  SessionState,
  TranscriptionResponse,
  VisibilityScope
} from "../../types";

import { formatDate, formatDuration } from "../../shared/lib/formatters";
import { StatusChip } from "../../shared/ui/call";
import { CallListSkeleton } from "../../shared/ui/loading";
import { SelectControl } from "../../shared/ui/primitives";
import { CallDetailPanel } from "./CallDetailPanel";

export function CallsPage({
  calls,
  companies,
  departments,
  selectedCall,
  selectedCallId,
  selectedCallTimeline,
  transcription,
  analysis,
  session,
  loading,
  loadingDetails,
  onSelectCall,
  onNavigate,
  onDeleteCall
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  selectedCallTimeline?: CallStatus[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  session: SessionState;
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onNavigate: (page: AppPage) => void;
  onDeleteCall?: (callId: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "7d" | "30d">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [serverCalls, setServerCalls] = useState<CallResponse[] | null>(null);
  const [filterOptions, setFilterOptions] = useState<CallFilterOptionsResponse | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const effectiveScopeFilter =
    companies.length === 0 && (scopeFilter === "company" || scopeFilter === "department")
      ? "all"
      : scopeFilter;
  const filterInput = {
    q: searchQuery.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    scope: effectiveScopeFilter === "all" ? undefined : effectiveScopeFilter,
    uploaded_by_user_uuid: managerFilter === "all" ? undefined : managerFilter,
    from: periodStart(periodFilter)
  };
  const hasBackendFilters = Object.values(filterInput).some(Boolean);
  const displayedCalls = serverCalls ?? calls;
  const filteredCalls = hasBackendFilters ? displayedCalls : calls.filter((call) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesScope = effectiveScopeFilter === "all" || call.visibility_scope === effectiveScopeFilter;
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesManager = managerFilter === "all" || call.uploaded_by_user_uuid === managerFilter;
    const matchesSearch = !query || callSearchText(call).includes(query);
    const matchesPeriod = isWithinPeriod(call.created_at, periodFilter);

    return matchesScope && matchesStatus && matchesManager && matchesSearch && matchesPeriod;
  });
  const managerOptions = filterOptions?.managers ?? [];
  const scopeOptions: Array<[VisibilityScope | "all", string]> = [
    ["all", "Все"],
    ["personal", "Личные"],
    ...(companies.length > 0
      ? ([
        ["company", "Компания"],
        ["department", "Отдел"]
      ] as Array<[VisibilityScope, string]>)
      : [])
  ];
  const filtersChanged =
    statusFilter !== "all" ||
    effectiveScopeFilter !== "all" ||
    managerFilter !== "all" ||
    periodFilter !== "all" ||
    searchQuery.trim().length > 0;

  function resetFilters() {
    setStatusFilter("all");
    setScopeFilter("all");
    setManagerFilter("all");
    setPeriodFilter("all");
    setSearchQuery("");
    setServerCalls(null);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .getCallFilterOptions()
      .then((response) => {
        if (!cancelled) setFilterOptions(response);
      })
      .catch(() => {
        if (!cancelled) setFilterOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasBackendFilters) {
      setServerCalls(null);
      setFiltersLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setFiltersLoading(true);
      api
        .listCalls({ ...filterInput, limit: 100, offset: 0 })
        .then((response) => {
          if (!cancelled) setServerCalls(Array.isArray(response) ? response : response.items);
        })
        .catch(() => {
          if (!cancelled) setServerCalls([]);
        })
        .finally(() => {
          if (!cancelled) setFiltersLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasBackendFilters, searchQuery, statusFilter, effectiveScopeFilter, managerFilter, periodFilter]);

  return (
    <section className="calls-layout">
      <aside className="calls-sidebar glass">
        <div className="panel-heading">
          <div>
            <h2>Звонки</h2>
            <p>Фильтры и детали выбранного звонка.</p>
          </div>
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <CloudUpload size={16} />
            Загрузить звонок
          </button>
        </div>
        <div className="calls-filter-bar">
          <SelectControl
            aria-label="Статус"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CallStatus | "all")}
          >
            <option value="all">Все статусы</option>
            <option value="new">Новые</option>
            <option value="processing">В обработке</option>
            <option value="transcribed">Расшифрованы</option>
            <option value="analyzed">Анализ готов</option>
            <option value="failed">Ошибки</option>
          </SelectControl>
          <SelectControl
            aria-label="Менеджер"
            value={managerFilter}
            onChange={(event) => setManagerFilter(event.target.value)}
          >
            <option value="all">Все менеджеры</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {managerLabel(manager, session)}
              </option>
            ))}
          </SelectControl>
          <SelectControl
            aria-label="Период"
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value as "all" | "7d" | "30d")}
          >
            <option value="all">Все даты</option>
            <option value="7d">Последние 7 дней</option>
            <option value="30d">Последние 30 дней</option>
          </SelectControl>
          <input
            aria-label="Поиск звонка"
            placeholder="Поиск по названию"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="segmented compact">
          {scopeOptions.map(([value, label]) => (
            <button
              key={value}
              className={effectiveScopeFilter === value ? "active" : ""}
              onClick={() => setScopeFilter(value as VisibilityScope | "all")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted-title">Недавние звонки</p>
        <div className="call-list">
          {(loading || filtersLoading) && <CallListSkeleton count={4} />}
          {!loading && !filtersLoading &&
            filteredCalls.map((call) => (
              <button
                key={call.id}
                className={`call-row ${selectedCallId === call.id ? "selected" : ""}`}
                onClick={() => onSelectCall(call.id)}
              >
                <span className="play-dot">
                  <Play size={14} fill="currentColor" />
                </span>
                <span className="call-row-main">
                  <StatusChip status={call.status} />
                  <strong>{call.title}</strong>
                  <small>
                    {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)}
                  </small>
                </span>
                <MoreVertical size={16} />
              </button>
            ))}
          {!loading && !filtersLoading && filteredCalls.length === 0 && (
            <div className="empty-state">{calls.length === 0 ? "Звонков пока нет." : "Звонков по фильтрам не найдено."}</div>
          )}
        </div>
        <button className="ghost-button wide calls-show-all" type="button" onClick={resetFilters} disabled={!filtersChanged}>
          {filtersChanged ? "Показать все звонки" : "Все звонки показаны"}
          <ChevronRight size={16} />
        </button>
      </aside>

      <section className="call-overview glass">
        <CallDetailPanel
          call={selectedCall}
          companies={companies}
          departments={departments}
          transcription={transcription}
          analysis={analysis}
          timelineStatuses={selectedCallTimeline}
          loading={loading}
          loadingDetails={loadingDetails}
          onNavigate={onNavigate}
          onDeleteCall={onDeleteCall}
          showReports
        />
      </section>
    </section>
  );
}

function managerLabel(
  manager: { id: string; full_name: string; full_surname: string; username: string },
  session: SessionState
) {
  if (manager.id === session.user.id) {
    return `${session.user.full_name} ${session.user.full_surname}`.trim() || "Мои звонки";
  }

  const fullName = `${manager.full_name} ${manager.full_surname}`.trim();
  return fullName || formatUsername(manager.username) || `Пользователь ${manager.id.slice(0, 8)}`;
}

function isWithinPeriod(value: string, period: "all" | "7d" | "30d") {
  if (period === "all") return true;

  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return false;

  const days = period === "7d" ? 7 : 30;
  return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
}

function periodStart(period: "all" | "7d" | "30d") {
  if (period === "all") return undefined;
  const date = new Date();
  date.setDate(date.getDate() - (period === "7d" ? 7 : 30));
  return date.toISOString();
}

function formatUsername(username: string) {
  const trimmed = username.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function callSearchText(call: CallResponse) {
  const maybeNamedCall = call as CallResponse & { name?: unknown };
  return [
    call.title,
    typeof maybeNamedCall.name === "string" ? maybeNamedCall.name : "",
    call.original_filename
  ].join(" ").toLowerCase();
}
