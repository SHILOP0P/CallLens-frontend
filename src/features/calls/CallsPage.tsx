import {
  Check,
  ChevronRight,
  CloudUpload,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../../api";
import type {
  AnalysisResponse,
  AppPage,
  CallFolderResponse,
  CallResponse,
  CallStatus,
  CallFilterOptionsResponse,
  CompanyResponse,
  CreateCallFolderRequest,
  DepartmentResponse,
  SessionState,
  TranscriptionResponse,
  UpdateCallFolderRequest,
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
  const [callFolders, setCallFolders] = useState<CallFolderResponse[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [editingFolderId, setEditingFolderId] = useState("");
  const [folderEditorOpen, setFolderEditorOpen] = useState(false);
  const [folderBusyId, setFolderBusyId] = useState("");
  const [folderForm, setFolderForm] = useState<FolderFormState>(() => emptyFolderForm());
  const effectiveScopeFilter =
    companies.length === 0 && (scopeFilter === "company" || scopeFilter === "department")
      ? "all"
      : scopeFilter;
  const filterInput = {
    q: searchQuery.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    scope: effectiveScopeFilter === "all" ? undefined : effectiveScopeFilter,
    uploaded_by_user_uuid: managerFilter === "all" ? undefined : managerFilter,
    folder_uuid: selectedFolderId || undefined,
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
  const visibleFolders = callFolders.filter((folder) =>
    effectiveScopeFilter === "all" || folder.scope === effectiveScopeFilter
  );
  const formDepartmentOptions = departments.filter((department) => department.company_uuid === folderForm.company_uuid);
  const companiesFolderKey = companies.map((company) => company.id).join("|");
  const departmentsFolderKey = departments.map((department) => `${department.company_uuid}:${department.id}`).join("|");
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
    selectedFolderId.length > 0 ||
    searchQuery.trim().length > 0;

  function resetFilters() {
    setStatusFilter("all");
    setScopeFilter("all");
    setManagerFilter("all");
    setPeriodFilter("all");
    setSearchQuery("");
    setSelectedFolderId("");
    setServerCalls(null);
  }

  async function refreshFolders() {
    setFoldersLoading(true);
    setFolderError("");
    try {
      const loadedFolders = await loadCallFoldersForContext(companies, departments);
      setCallFolders(loadedFolders);
      setSelectedFolderId((current) =>
        current && loadedFolders.some((folder) => folder.id === current) ? current : ""
      );
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Не удалось загрузить папки");
      setCallFolders([]);
      setSelectedFolderId("");
    } finally {
      setFoldersLoading(false);
    }
  }

  function startFolderCreate() {
    setEditingFolderId("");
    setFolderError("");
    setFolderForm(emptyFolderForm());
    setFolderEditorOpen(true);
  }

  function startFolderEdit(folder: CallFolderResponse) {
    setEditingFolderId(folder.id);
    setFolderError("");
    setFolderForm({
      scope: folder.scope === "company" || folder.scope === "department" ? folder.scope : "personal",
      company_uuid: folder.company_uuid ?? "",
      department_uuid: folder.department_uuid ?? "",
      name: folder.name,
      description: folder.description ?? "",
      color: folder.color ?? folderPalette[0]
    });
    setFolderEditorOpen(true);
  }

  function cancelFolderEdit() {
    setEditingFolderId("");
    setFolderError("");
    setFolderForm(emptyFolderForm());
    setFolderEditorOpen(false);
  }

  async function submitFolderForm() {
    const payload = buildFolderPayload(folderForm, editingFolderId ? "update" : "create");
    if (!payload.ok) {
      setFolderError(payload.error);
      return;
    }

    setFolderError("");
    setFolderBusyId(editingFolderId || "create");

    try {
      if (editingFolderId) {
        await api.updateCallFolder(editingFolderId, payload.value as UpdateCallFolderRequest);
      } else {
        await api.createCallFolder(payload.value as CreateCallFolderRequest);
      }
      cancelFolderEdit();
      await refreshFolders();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Не удалось сохранить папку");
    } finally {
      setFolderBusyId("");
    }
  }

  async function deleteFolder(folder: CallFolderResponse) {
    const confirmed = window.confirm(`Удалить папку "${folder.name}"? Звонки не будут удалены.`);
    if (!confirmed) return;

    setFolderError("");
    setFolderBusyId(folder.id);
    try {
      await api.deleteCallFolder(folder.id);
      if (selectedFolderId === folder.id) setSelectedFolderId("");
      if (editingFolderId === folder.id) cancelFolderEdit();
      await refreshFolders();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Не удалось удалить папку");
    } finally {
      setFolderBusyId("");
    }
  }

  async function assignCallToFolder(folderId: string, callId: string) {
    setFolderError("");
    setFolderBusyId(folderId);
    try {
      await api.assignCallToFolder(folderId, callId);
      await refreshFolders();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Не удалось добавить звонок в папку");
    } finally {
      setFolderBusyId("");
    }
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
    void refreshFolders();
  }, [companiesFolderKey, departmentsFolderKey]);

  useEffect(() => {
    if (companies.length > 0 || folderForm.scope === "personal") return;
    setFolderForm((current) => ({ ...current, scope: "personal", company_uuid: "", department_uuid: "" }));
  }, [companies.length, folderForm.scope]);

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
        .catch((error) => {
          if (cancelled) return;
          if (error instanceof ApiError && error.code === "call_folder_not_found") {
            setSelectedFolderId("");
            void refreshFolders();
          }
          setServerCalls([]);
        })
        .finally(() => {
          if (!cancelled) setFiltersLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasBackendFilters, searchQuery, statusFilter, effectiveScopeFilter, managerFilter, periodFilter, selectedFolderId]);

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
        <section className="call-folder-panel">
          <div className="call-folder-heading">
            <div>
              <strong>Папки</strong>
              <small>{foldersLoading ? "Загружаю..." : `${visibleFolders.length} доступно`}</small>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Создать папку"
              onClick={startFolderCreate}
            >
              <Plus size={16} />
            </button>
          </div>
          {folderError && <div className="form-error compact">{folderError}</div>}
          <div className="call-folder-list">
            <button
              className={`call-folder-row ${!selectedFolderId ? "selected" : ""}`}
              type="button"
              onClick={() => setSelectedFolderId("")}
            >
              <span className="folder-color-dot neutral" />
              <span>
                <strong>Все папки</strong>
                <small>Фильтр по папке выключен</small>
              </span>
            </button>
            {visibleFolders.map((folder) => (
              <div className={`call-folder-row with-actions ${selectedFolderId === folder.id ? "selected" : ""}`} key={folder.id}>
                <button type="button" onClick={() => setSelectedFolderId(folder.id)}>
                  <span
                    className="folder-color-dot"
                    style={{ "--folder-color": folder.color || "#ff7a43" } as React.CSSProperties}
                  />
                  <span>
                    <strong title={folder.name}>{folder.name}</strong>
                    <small>{folderScopeLabel(folder)} · {folder.calls_count} звонков</small>
                  </span>
                </button>
                <div className="call-folder-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Редактировать папку"
                    onClick={() => startFolderEdit(folder)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label="Удалить папку"
                    disabled={folderBusyId === folder.id}
                    onClick={() => deleteFolder(folder)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {!foldersLoading && visibleFolders.length === 0 && (
              <div className="empty-state compact">Папок для выбранной области пока нет.</div>
            )}
          </div>
        </section>
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
          folders={callFolders}
          folderActionBusy={Boolean(folderBusyId)}
          onAssignToFolder={assignCallToFolder}
          showReports
        />
      </section>
      {folderEditorOpen && (
        <div className="call-folder-modal-layer" role="presentation">
          <section className="call-folder-modal" role="dialog" aria-modal="true" aria-label={editingFolderId ? "Редактировать папку" : "Новая папка"}>
            <div className="call-folder-modal-head">
              <div>
                <strong>{editingFolderId ? "Редактировать папку" : "Новая папка"}</strong>
                <small>Папка группирует звонки и используется как фильтр.</small>
              </div>
              <button className="icon-button" type="button" aria-label="Закрыть окно папки" onClick={cancelFolderEdit}>
                <X size={17} />
              </button>
            </div>
            {folderError && <div className="form-error compact">{folderError}</div>}
            <div className="call-folder-form modal-form">
              {!editingFolderId && (
                <SelectControl
                  aria-label="Область папки"
                  value={folderForm.scope}
                  onChange={(event) => {
                    const scope = event.target.value as VisibilityScope;
                    const nextCompanyId = scope === "personal" ? "" : folderForm.company_uuid || companies[0]?.id || "";
                    const nextDepartmentId =
                      scope === "department"
                        ? folderForm.department_uuid || departments.find((department) => department.company_uuid === nextCompanyId)?.id || ""
                        : "";
                    setFolderForm((current) => ({
                      ...current,
                      scope,
                      company_uuid: nextCompanyId,
                      department_uuid: nextDepartmentId
                    }));
                  }}
                >
                  <option value="personal">Личная</option>
                  {companies.length > 0 && <option value="company">Компания</option>}
                  {companies.length > 0 && <option value="department">Отдел</option>}
                </SelectControl>
              )}
              {!editingFolderId && folderForm.scope !== "personal" && (
                <SelectControl
                  aria-label="Компания папки"
                  value={folderForm.company_uuid}
                  onChange={(event) => {
                    const companyId = event.target.value;
                    const departmentId = departments.find((department) => department.company_uuid === companyId)?.id ?? "";
                    setFolderForm((current) => ({
                      ...current,
                      company_uuid: companyId,
                      department_uuid: current.scope === "department" ? departmentId : ""
                    }));
                  }}
                >
                  <option value="">Выберите компанию</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </SelectControl>
              )}
              {!editingFolderId && folderForm.scope === "department" && (
                <SelectControl
                  aria-label="Отдел папки"
                  value={folderForm.department_uuid}
                  onChange={(event) => setFolderForm((current) => ({ ...current, department_uuid: event.target.value }))}
                >
                  <option value="">Выберите отдел</option>
                  {formDepartmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </SelectControl>
              )}
              <input
                aria-label="Название папки"
                placeholder="Название папки"
                value={folderForm.name}
                maxLength={120}
                onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                aria-label="Описание папки"
                placeholder="Описание"
                value={folderForm.description}
                maxLength={1000}
                onChange={(event) => setFolderForm((current) => ({ ...current, description: event.target.value }))}
              />
              <div className="call-folder-color-picker" aria-label="Цвет папки">
                <div className="call-folder-color-picker-head">
                  <span>Цвет папки</span>
                  <span
                    className="folder-color-dot preview"
                    style={{ "--folder-color": folderForm.color || folderPalette[0] } as React.CSSProperties}
                  />
                </div>
                <div className="call-folder-palette" role="radiogroup" aria-label="Выбор цвета папки">
                  {folderPalette.map((color) => (
                    <button
                      className={folderForm.color === color ? "active" : ""}
                      key={color}
                      type="button"
                      role="radio"
                      aria-label={`Цвет ${color}`}
                      aria-checked={folderForm.color === color}
                      onClick={() => setFolderForm((current) => ({ ...current, color }))}
                      style={{ "--folder-color": color } as React.CSSProperties}
                    >
                      <span />
                    </button>
                  ))}
                </div>
              </div>
              <div className="call-folder-form-actions">
                <button
                  className="primary-button small"
                  type="button"
                  disabled={folderBusyId === "create" || (Boolean(editingFolderId) && folderBusyId === editingFolderId)}
                  onClick={submitFolderForm}
                >
                  <Check size={15} />
                  {editingFolderId ? "Сохранить" : "Создать"}
                </button>
                <button className="ghost-button small" type="button" onClick={cancelFolderEdit}>
                  Отмена
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

type FolderFormState = {
  scope: VisibilityScope;
  company_uuid: string;
  department_uuid: string;
  name: string;
  description: string;
  color: string;
};

const folderPalette = [
  "#FF7A43",
  "#F45B69",
  "#B45CFF",
  "#5B7CFA",
  "#2F9BFF",
  "#21A6A1",
  "#5EBC6E",
  "#F0B84A",
  "#A88768",
  "#8B98A8"
];

type FolderPayloadResult =
  | { ok: true; value: CreateCallFolderRequest | UpdateCallFolderRequest }
  | { ok: false; error: string };

function emptyFolderForm(): FolderFormState {
  return {
    scope: "personal",
    company_uuid: "",
    department_uuid: "",
    name: "",
    description: "",
    color: folderPalette[0]
  };
}

function buildFolderPayload(
  form: FolderFormState,
  mode: "create" | "update"
): FolderPayloadResult {
  const name = form.name.trim();
  const description = form.description.trim();
  const color = form.color.trim();

  if (!name) return { ok: false, error: "Введите название папки." };
  if (name.length > 120) return { ok: false, error: "Название папки должно быть до 120 символов." };
  if (description.length > 1000) return { ok: false, error: "Описание папки должно быть до 1000 символов." };
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { ok: false, error: "Цвет должен быть в формате #RRGGBB." };
  }

  if (mode === "update") {
    return {
      ok: true,
      value: {
        name,
        description: description || null,
        color: color || null
      }
    };
  }

  if (form.scope === "company" && !form.company_uuid) {
    return { ok: false, error: "Для папки компании выберите компанию." };
  }

  if (form.scope === "department" && (!form.company_uuid || !form.department_uuid)) {
    return { ok: false, error: "Для папки отдела выберите компанию и отдел." };
  }

  return {
    ok: true,
    value: {
      scope: form.scope,
      company_uuid: form.scope === "personal" ? null : form.company_uuid,
      department_uuid: form.scope === "department" ? form.department_uuid : null,
      name,
      description: description || null,
      color: color || null
    }
  };
}

function folderScopeLabel(folder: CallFolderResponse) {
  if (folder.scope === "personal") return "Личная";
  if (folder.scope === "company") return "Компания";
  if (folder.scope === "department") return "Отдел";
  return folder.scope || "Область";
}

async function loadCallFoldersForContext(
  companies: CompanyResponse[],
  departments: DepartmentResponse[]
) {
  const requests = [
    api.listCallFolders({ scope: "personal", limit: 100, offset: 0 }),
    ...companies.map((company) =>
      api.listCallFolders({
        scope: "company",
        company_uuid: company.id,
        limit: 100,
        offset: 0
      })
    ),
    ...departments.map((department) =>
      api.listCallFolders({
        scope: "department",
        company_uuid: department.company_uuid,
        department_uuid: department.id,
        limit: 100,
        offset: 0
      })
    )
  ];
  const responses = await Promise.all(
    requests.map((request) => request.catch(() => ({ items: [] as CallFolderResponse[] })))
  );
  const folders = new Map<string, CallFolderResponse>();

  responses.forEach((response) => {
    response.items.forEach((folder) => folders.set(folder.id, folder));
  });

  return Array.from(folders.values());
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
