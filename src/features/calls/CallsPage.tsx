import {
  Check,
  ChevronDown,
  ChevronRight,
  CloudUpload,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, api } from "../../api";
import type {
  AnalysisResponse,
  AnalysisInstruction,
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
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { useEscapeDismiss } from "../../shared/ui/dismissible-layer";
import { CallListSkeleton } from "../../shared/ui/loading";
import { SelectControl } from "../../shared/ui/primitives";
import { CustomScrollbar } from "../../shared/ui/custom-scrollbar";
import { MobileCallDrawerTrigger } from "../../shared/ui/mobile-call-drawer-trigger";
import { CallDetailPanel } from "./CallDetailPanel";
import {
  callSearchText,
  folderScopeLabel,
  formatUsername,
  friendlyCallActionError,
  isWithinPeriod,
  loadCallFoldersForContext,
  managerLabel,
  periodStart
} from "./call-page-utils";

export function CallsPage({
  calls,
  companies,
  departments,
  selectedCall,
  selectedCallId,
  selectedCallTimeline,
  transcription,
  analysis,
  analyses,
  session,
  loading,
  loadingDetails,
  onSelectCall,
  onNavigate,
  onUpdateCallTitle,
  onDeleteCall,
  onOpenTranscriptionEditor,
  onOpenRevisionComparison
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  selectedCallTimeline?: CallStatus[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  analyses: Record<string, AnalysisResponse>;
  session: SessionState;
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onNavigate: (page: AppPage) => void;
  onUpdateCallTitle?: (callId: string, title: string) => Promise<CallResponse>;
  onDeleteCall?: (callId: string) => Promise<void>;
  onOpenTranscriptionEditor?: (callId: string) => void;
  onOpenRevisionComparison?: (callId: string, revision?: number) => void;
}) {
  const callsSidebarScrollRef = useRef<HTMLElement | null>(null);
  const callOverviewScrollRef = useRef<HTMLElement | null>(null);
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
  const [callFolderActionByCall, setCallFolderActionByCall] = useState<Record<string, string>>({});
  const [folderCallsById, setFolderCallsById] = useState<Record<string, CallResponse[]>>({});
  const [folderCallsLoading, setFolderCallsLoading] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});
  const [folderForm, setFolderForm] = useState<FolderFormState>(() => emptyFolderForm());
  const [folderInstructionOptions, setFolderInstructionOptions] = useState<AnalysisInstruction[]>([]);
  const [openFolderMenuId, setOpenFolderMenuId] = useState("");
  const [openCallMenuId, setOpenCallMenuId] = useState("");
  const [editingCall, setEditingCall] = useState<CallResponse | null>(null);
  const [callTitleDraft, setCallTitleDraft] = useState("");
  const [callActionError, setCallActionError] = useState("");
  const [callBusyId, setCallBusyId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [favoriteCallIds, setFavoriteCallIds] = useState<string[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
  const callsRefreshKey = calls.map((call) => `${call.id}:${call.status}`).join("|");
  const filteredCalls = (hasBackendFilters ? displayedCalls : calls).filter((call) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesScope = effectiveScopeFilter === "all" || call.visibility_scope === effectiveScopeFilter;
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesManager = managerFilter === "all" || call.uploaded_by_user_uuid === managerFilter;
    const matchesSearch = !query || callSearchText(call).includes(query);
    const matchesPeriod = isWithinPeriod(call.created_at, periodFilter);

    return matchesScope && matchesStatus && matchesManager && matchesSearch && matchesPeriod;
  });

  const [favoriteOnly, setFavoriteOnly] = useState(false);
  useEffect(() => { api.listFavoriteCalls().then((items) => setFavoriteCallIds(items.map((call) => call.id))).catch(() => setFavoriteCallIds([])); }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileSidebarOpen]);

  async function toggleFavoriteCall(callId: string) {
    const isFavorite = favoriteCallIds.includes(callId);
    setCallBusyId(callId);
    try {
      if (isFavorite) { await api.removeFavoriteCall(callId); setFavoriteCallIds((items) => items.filter((id) => id !== callId)); }
      else { await api.addFavoriteCall(callId); setFavoriteCallIds((items) => [...items, callId]); }
    } catch (error) { setCallActionError(friendlyCallActionError(error, "Не удалось изменить избранное.")); }
    finally { setCallBusyId(""); }
  }

  useEffect(() => {
    if (!folderEditorOpen) return;
    let cancelled = false;
    const companyUuid = folderForm.scope === "personal" ? undefined : folderForm.company_uuid || undefined;
    const departmentUuid = folderForm.scope === "department" ? folderForm.department_uuid || undefined : undefined;
    api.listInstructions({
      scope: folderForm.scope,
      company_uuid: companyUuid,
      department_uuid: departmentUuid
    }).then((items) => {
      if (!cancelled) setFolderInstructionOptions(items.filter((item) => item.is_active));
    }).catch(() => {
      if (!cancelled) setFolderInstructionOptions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [folderEditorOpen, folderForm.company_uuid, folderForm.department_uuid, folderForm.scope]);
  const managerOptions = filterOptions?.managers ?? [];
  const visibleFolders = callFolders.filter((folder) =>
    effectiveScopeFilter === "all" || folder.scope === effectiveScopeFilter
  );
  const formDepartmentOptions = departments.filter((department) => department.company_uuid === folderForm.company_uuid);
  const companiesFolderKey = companies.map((company) => company.id).join("|");
  const departmentsFolderKey = departments.map((department) => `${department.company_uuid}:${department.id}`).join("|");
  const visibleFolderIdsKey = visibleFolders.map((folder) => folder.id).join("|");
  const folderCallIds = new Set(Object.values(folderCallsById).flatMap((folderCalls) => folderCalls.map((call) => call.id)));
  const callsWithoutVisibleFolder = filteredCalls.filter((call) => !folderCallIds.has(call.id));
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
  const selectedCallVisibleInFolderFilter = Boolean(
    selectedFolderId &&
    selectedCall &&
    (folderCallsById[selectedFolderId] ?? []).some((call) => call.id === selectedCall.id)
  );
  const selectedCallActionFolderId = selectedCall
    ? (selectedCallVisibleInFolderFilter ? selectedFolderId : callFolderActionByCall[selectedCall.id]) || ""
    : "";
  const selectedCallActionFolder = selectedCallActionFolderId
    ? callFolders.find((folder) => folder.id === selectedCallActionFolderId)
    : undefined;

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
      ,instruction_uuids: folder.instructions?.map((instruction) => instruction.id) ?? []
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
        await api.replaceCallFolderInstructions(editingFolderId, folderForm.instruction_uuids);
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

  function requestFolderDelete(folder: CallFolderResponse) {
    setOpenFolderMenuId("");
    setFolderError("");
    setPendingDelete({ type: "folder", folder });
  }

  async function assignCallToFolder(folderId: string, callId: string) {
    setFolderError("");
    setFolderBusyId(folderId);
    try {
      await api.assignCallToFolder(folderId, callId);
      setCallFolderActionByCall((current) => ({ ...current, [callId]: folderId }));
      const assignedCall = calls.find((call) => call.id === callId);
      if (assignedCall) {
        setFolderCallsById((current) => ({
          ...current,
          [folderId]: [
            assignedCall,
            ...(current[folderId] ?? []).filter((call) => call.id !== callId)
          ]
        }));
      }
      setExpandedFolderIds((current) => ({ ...current, [folderId]: true }));
      await refreshFolders();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Не удалось добавить звонок в папку");
    } finally {
      setFolderBusyId("");
    }
  }

  async function removeCallFromFolder(folderId: string, callId: string) {
    setFolderError("");
    setFolderBusyId(folderId);
    try {
      await api.removeCallFromFolder(folderId, callId);
      setCallFolderActionByCall((current) => {
        if (current[callId] !== folderId) return current;
        const next = { ...current };
        delete next[callId];
        return next;
      });
      setFolderCallsById((current) => ({
        ...current,
        [folderId]: (current[folderId] ?? []).filter((call) => call.id !== callId)
      }));
      if (selectedFolderId === folderId) {
        setSelectedFolderId("");
      }
      await refreshFolders();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Не удалось убрать звонок из папки");
    } finally {
      setFolderBusyId("");
    }
  }

  function toggleCallMenu(callId: string) {
    setCallActionError("");
    setOpenFolderMenuId("");
    setOpenCallMenuId((current) => (current === callId ? "" : callId));
  }

  function toggleFolderMenu(folderId: string) {
    setFolderError("");
    setOpenCallMenuId("");
    setOpenFolderMenuId((current) => (current === folderId ? "" : folderId));
  }

  function startCallRename(call: CallResponse) {
    setOpenCallMenuId("");
    setCallActionError("");
    setEditingCall(call);
    setCallTitleDraft(call.title);
  }

  function cancelCallRename() {
    setEditingCall(null);
    setCallTitleDraft("");
    setCallActionError("");
  }

  function patchCallInLocalLists(updatedCall: CallResponse) {
    setServerCalls((current) =>
      current ? current.map((call) => (call.id === updatedCall.id ? updatedCall : call)) : current
    );
    setFolderCallsById((current) =>
      Object.fromEntries(
        Object.entries(current).map(([folderId, folderCalls]) => [
          folderId,
          folderCalls.map((call) => (call.id === updatedCall.id ? updatedCall : call))
        ])
      )
    );
  }

  async function submitCallRename() {
    if (!editingCall || !onUpdateCallTitle) return;

    const title = callTitleDraft.trim();
    if (!title) {
      setCallActionError("Введите название звонка.");
      return;
    }

    setCallActionError("");
    setCallBusyId(editingCall.id);
    try {
      const updatedCall = await onUpdateCallTitle(editingCall.id, title);
      patchCallInLocalLists(updatedCall);
      cancelCallRename();
    } catch (error) {
      setCallActionError(friendlyCallActionError(error, "Не удалось переименовать звонок."));
    } finally {
      setCallBusyId("");
    }
  }

  async function deleteCallFromMenu(call: CallResponse) {
    if (!onDeleteCall) return;

    setOpenCallMenuId("");
    setCallActionError("");
    setCallBusyId(call.id);
    try {
      await onDeleteCall(call.id);
      setServerCalls((current) => (current ? current.filter((item) => item.id !== call.id) : current));
      setFolderCallsById((current) =>
        Object.fromEntries(
          Object.entries(current).map(([folderId, folderCalls]) => [
            folderId,
            folderCalls.filter((item) => item.id !== call.id)
          ])
        )
      );
    } catch (error) {
      setCallActionError(friendlyCallActionError(error, "Не удалось удалить звонок."));
    } finally {
      setCallBusyId("");
    }
  }

  function requestCallDelete(call: CallResponse) {
    setOpenCallMenuId("");
    setCallActionError("");
    setPendingDelete({ type: "call", call });
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.type === "folder") {
      await deleteFolder(pendingDelete.folder);
    } else {
      await deleteCallFromMenu(pendingDelete.call);
    }
    setPendingDelete(null);
  }

  useEscapeDismiss(folderEditorOpen && !folderBusyId, cancelFolderEdit);
  useEscapeDismiss(Boolean(editingCall) && !callBusyId, cancelCallRename);

  useEffect(() => {
    if (!openCallMenuId && !openFolderMenuId) return;

    const closeMenu = () => {
      setOpenCallMenuId("");
      setOpenFolderMenuId("");
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openCallMenuId, openFolderMenuId]);

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
    const callsById = new Map(calls.map((call) => [call.id, call]));
    setFolderCallsById((current) =>
      Object.fromEntries(
        Object.entries(current).map(([folderId, folderCalls]) => [
          folderId,
          folderCalls.map((call) => callsById.get(call.id) ?? call)
        ])
      )
    );
  }, [callsRefreshKey]);

  useEffect(() => {
    if (visibleFolders.length === 0) {
      setFolderCallsById({});
      setFolderCallsLoading(false);
      return;
    }

    let cancelled = false;
    setFolderCallsLoading(true);
    Promise
      .all(
        visibleFolders.map((folder) =>
          api
            .listCallFolderCalls(folder.id, { limit: 100, offset: 0 })
            .then((response) => [
              folder.id,
              Array.isArray(response) ? response : response.items
            ] as const)
            .catch(() => [folder.id, [] as CallResponse[]] as const)
        )
      )
      .then((entries) => {
        if (cancelled) return;
        setFolderCallsById(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setFolderCallsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visibleFolderIdsKey]);

  function toggleFolder(folderId: string) {
    setExpandedFolderIds((current) => ({ ...current, [folderId]: !current[folderId] }));
  }

  function selectFolderCall(callId: string, folderId: string) {
    setSelectedFolderId(folderId);
    setCallFolderActionByCall((current) => ({ ...current, [callId]: folderId }));
    onSelectCall(callId);
  }

  function selectUnfiledCall(callId: string) {
    setSelectedFolderId("");
    setCallFolderActionByCall((current) => {
      if (!current[callId]) return current;
      const next = { ...current };
      delete next[callId];
      return next;
    });
    onSelectCall(callId);
  }

  function matchesSidebarFilters(call: CallResponse) {
    const query = searchQuery.trim().toLowerCase();
    const matchesScope = effectiveScopeFilter === "all" || call.visibility_scope === effectiveScopeFilter;
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesManager = managerFilter === "all" || call.uploaded_by_user_uuid === managerFilter;
    const matchesSearch = !query || callSearchText(call).includes(query);
    const matchesPeriod = isWithinPeriod(call.created_at, periodFilter);

    return matchesScope && matchesStatus && matchesManager && matchesSearch && matchesPeriod;
  }

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
  }, [hasBackendFilters, searchQuery, statusFilter, effectiveScopeFilter, managerFilter, periodFilter, selectedFolderId, callsRefreshKey]);

  function renderSidebarCallRow(call: CallResponse, folderId?: string) {
    const selected = selectedCallId === call.id;
    const open = openCallMenuId === call.id;
    const isFavorite = favoriteCallIds.includes(call.id);
    const selectCallFromRow = () => {
      if (folderId) {
        selectFolderCall(call.id, folderId);
      } else {
        selectUnfiledCall(call.id);
      }
      setMobileSidebarOpen(false);
    };

    return (
      <div
        key={folderId ? `${folderId}-${call.id}` : call.id}
        className={`call-row ${selected ? "selected" : ""} ${open ? "menu-open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={selectCallFromRow}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selectCallFromRow();
        }}
      >
        <span className="play-dot">
          <Play size={14} fill="currentColor" />
        </span>
        <span className="call-row-main">
          <StatusChip status={call.status} analysisStatus={analyses[call.id]?.status} />
          <strong>{call.title}</strong>
          <small>
            {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)}
          </small>
        </span>
        <span
          className="call-row-actions"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button className={`icon-button call-favorite-button ${isFavorite ? "active" : ""}`} type="button" aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"} disabled={callBusyId === call.id} onClick={() => void toggleFavoriteCall(call.id)}><Star size={15} fill={isFavorite ? "currentColor" : "none"} /></button>
          <button
            className="icon-button call-row-menu-trigger"
            type="button"
            aria-label="Действия со звонком"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={callBusyId === call.id}
            onClick={() => toggleCallMenu(call.id)}
          >
            <MoreVertical size={16} />
          </button>
          {open && (
            <span className="call-row-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => startCallRename(call)}>
                <Pencil size={15} />
                Переименовать
              </button>
              <button
                className="danger"
                type="button"
                role="menuitem"
                disabled={!onDeleteCall || callBusyId === call.id}
                onClick={() => requestCallDelete(call)}
              >
                <Trash2 size={15} />
                Удалить
              </button>
            </span>
          )}
        </span>
      </div>
    );
  }

  const pendingDeleteCopy = pendingDelete
    ? pendingDelete.type === "folder"
      ? {
        title: "Удалить папку?",
        message: `Папка «${pendingDelete.folder.name}» будет удалена. Звонки останутся в системе и не будут удалены.`
      }
      : {
        title: "Удалить звонок?",
        message: `Звонок «${pendingDelete.call.title}» будет удален без возможности восстановления.`
      }
    : null;
  const pendingDeleteBusy = pendingDelete
    ? pendingDelete.type === "folder"
      ? folderBusyId === pendingDelete.folder.id
      : callBusyId === pendingDelete.call.id
    : false;

  return (
    <section className="calls-layout atmospheric-page">
      <aside
        id="mobile-call-drawer"
        className={`calls-sidebar mobile-call-drawer glass custom-scroll-target ${mobileSidebarOpen ? "open" : ""}`}
        ref={callsSidebarScrollRef}
        aria-label="Звонки, фильтры и папки"
      >
        <div className="panel-heading">
          <div>
            <h2>Звонки</h2>
            <p>Фильтры и детали выбранного звонка.</p>
          </div>
          <div className="mobile-call-drawer-heading-actions">
            <button className="primary-button small" onClick={() => onNavigate("upload")}>
              <CloudUpload size={16} />
              Загрузить звонок
            </button>
            <button
              className="icon-button mobile-call-drawer-close"
              type="button"
              aria-label="Закрыть звонки и фильтры"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
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
        <label className={`call-favorite-filter ${favoriteOnly ? "checked" : ""}`}>
          <input
            className="call-favorite-filter-input"
            type="checkbox"
            checked={favoriteOnly}
            onChange={(event) => setFavoriteOnly(event.target.checked)}
          />
          <span className="call-favorite-filter-box" aria-hidden="true">
            {favoriteOnly && <Check size={12} strokeWidth={3} />}
          </span>
          <span>Только избранные</span>
        </label>
        <div className="call-scope-tabs segmented scope">
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
          {callActionError && !editingCall && <div className="form-error compact">{callActionError}</div>}
          <div className="call-folder-tree">
            {visibleFolders.map((folder) => {
              const expanded = Boolean(expandedFolderIds[folder.id]);
              const folderCalls = (folderCallsById[folder.id] ?? []).filter(matchesSidebarFilters).filter((call) => !favoriteOnly || favoriteCallIds.includes(call.id));
              const folderLoading = folderCallsLoading && !folderCallsById[folder.id];

              return (
                <div className={`call-folder-project ${expanded ? "expanded" : ""}`} key={folder.id}>
                  <div className="call-folder-project-head">
                    <button
                      className="call-folder-project-button"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      <span
                        className="folder-color-dot"
                        style={{ "--folder-color": folder.color || "#ff7a43" } as React.CSSProperties}
                      />
                      <span>
                        <strong title={folder.name}>{folder.name}</strong>
                        <small>
                          {folderScopeLabel(folder)} · {folder.calls_count} звонков · {folder.instructions?.length ?? 0} инструкций
                        </small>
                      </span>
                    </button>
                    <div
                      className="call-folder-actions"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <button
                        className="icon-button call-folder-menu-trigger"
                        type="button"
                        aria-label="Действия с папкой"
                        aria-haspopup="menu"
                        aria-expanded={openFolderMenuId === folder.id}
                        disabled={folderBusyId === folder.id}
                        onClick={() => toggleFolderMenu(folder.id)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {openFolderMenuId === folder.id && (
                        <span className="call-row-menu call-folder-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => startFolderEdit(folder)}>
                            <Pencil size={15} />
                            Переименовать
                          </button>
                          <button
                            className="danger"
                            type="button"
                            role="menuitem"
                            disabled={folderBusyId === folder.id}
                            onClick={() => requestFolderDelete(folder)}
                          >
                            <Trash2 size={15} />
                            Удалить
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <div className="call-folder-child-list">
                      {(folder.instructions?.length ?? 0) > 0 && (
                        <div className="folder-instruction-chips call-folder-tree-instructions" aria-label="Инструкции папки">
                          {folder.instructions.map((instruction) => (
                            <span key={instruction.id}>{instruction.title}</span>
                          ))}
                        </div>
                      )}
                      {folderLoading ? (
                        <div className="call-folder-child-empty">Загружаю звонки...</div>
                      ) : folderCalls.length === 0 ? (
                        <div className="call-folder-child-empty">Нет звонков по текущим фильтрам.</div>
                      ) : (
                        folderCalls.map((call) => renderSidebarCallRow(call, folder.id))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!foldersLoading && visibleFolders.length === 0 && (
              <div className="empty-state compact">Папок для выбранной области пока нет.</div>
            )}
          </div>
        </section>
        <p className="muted-title">Без папки</p>
        <div className="call-list">
          {(loading || filtersLoading || folderCallsLoading) && <CallListSkeleton count={4} />}
          {!loading && !filtersLoading && !folderCallsLoading &&
            callsWithoutVisibleFolder.filter((call) => !favoriteOnly || favoriteCallIds.includes(call.id)).map((call) => renderSidebarCallRow(call))}
          {!loading && !filtersLoading && !folderCallsLoading && callsWithoutVisibleFolder.length === 0 && (
            <div className="empty-state">{calls.length === 0 ? "Звонков пока нет." : "Звонков без папки по фильтрам нет."}</div>
          )}
        </div>
        <button className="ghost-button wide calls-show-all" type="button" onClick={resetFilters} disabled={!filtersChanged}>
          {filtersChanged ? "Показать все звонки" : "Все звонки показаны"}
          <ChevronRight size={16} />
        </button>
      </aside>
      <button
        className={`mobile-call-drawer-backdrop ${mobileSidebarOpen ? "open" : ""}`}
        type="button"
        aria-label="Закрыть звонки и фильтры"
        tabIndex={mobileSidebarOpen ? 0 : -1}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <CustomScrollbar targetRef={callsSidebarScrollRef} className="mobile-call-drawer-scroll-thumb" />

      <section className="call-overview glass custom-scroll-target" ref={callOverviewScrollRef}>
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
          onOpenTranscriptionEditor={onOpenTranscriptionEditor}
          onOpenRevisionComparison={onOpenRevisionComparison}
          folders={callFolders}
          activeFolder={selectedCallActionFolder}
          folderActionBusy={Boolean(folderBusyId)}
          onAssignToFolder={assignCallToFolder}
          onRemoveFromFolder={removeCallFromFolder}
          drawerTrigger={<MobileCallDrawerTrigger open={mobileSidebarOpen} onToggle={() => setMobileSidebarOpen((current) => !current)} />}
          showReports
        />
      </section>
      <CustomScrollbar targetRef={callOverviewScrollRef} />
      {folderEditorOpen && createPortal(
        <div
          className="call-folder-modal-layer"
          role="presentation"
          onPointerDown={(event) => {
            if (!folderBusyId && event.target === event.currentTarget) cancelFolderEdit();
          }}
        >
          <form
            className="call-folder-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingFolderId ? "Редактировать папку" : "Новая папка"}
            onSubmit={(event) => {
              event.preventDefault();
              void submitFolderForm();
            }}
          >
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
              <fieldset className="call-folder-instructions">
                <legend>Инструкции папки</legend>
                <small>Они автоматически применятся к каждому новому звонку в этой папке.</small>
                {folderInstructionOptions.length === 0 ? (
                  <div className="instruction-empty compact">Для выбранной области нет активных инструкций.</div>
                ) : (
                  <div className="call-folder-instruction-options">
                    {folderInstructionOptions.map((instruction) => (
                      <label key={instruction.id}>
                        <input
                          type="checkbox"
                          checked={folderForm.instruction_uuids.includes(instruction.id)}
                          onChange={() => setFolderForm((current) => ({
                            ...current,
                            instruction_uuids: current.instruction_uuids.includes(instruction.id)
                              ? current.instruction_uuids.filter((id) => id !== instruction.id)
                              : [...current.instruction_uuids, instruction.id]
                          }))}
                        />
                        <span>{instruction.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <div className="call-folder-form-actions">
                <button
                  className="primary-button small"
                  type="submit"
                  disabled={folderBusyId === "create" || (Boolean(editingFolderId) && folderBusyId === editingFolderId)}
                >
                  <Check size={15} />
                  {editingFolderId ? "Сохранить" : "Создать"}
                </button>
                <button className="ghost-button small" type="button" onClick={cancelFolderEdit}>
                  Отмена
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      )}
      {editingCall && (
        <div
          className="call-folder-modal-layer"
          role="presentation"
          onPointerDown={(event) => {
            if (!callBusyId && event.target === event.currentTarget) cancelCallRename();
          }}
        >
          <form
            className="call-folder-modal call-title-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Переименовать звонок"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCallRename();
            }}
          >
            <div className="call-folder-modal-head">
              <div>
                <strong>Переименовать звонок</strong>
                <small>{editingCall.original_filename}</small>
              </div>
              <button className="icon-button" type="button" aria-label="Закрыть окно переименования" onClick={cancelCallRename}>
                <X size={17} />
              </button>
            </div>
            {callActionError && <div className="form-error compact">{callActionError}</div>}
            <label className="call-title-field">
              Название звонка
              <div className="input-with-counter">
                <input
                  value={callTitleDraft}
                  maxLength={255}
                  autoFocus
                  onChange={(event) => setCallTitleDraft(event.target.value)}
                />
                <span>{callTitleDraft.length} / 255</span>
              </div>
            </label>
            <div className="call-title-modal-actions">
              <button
                className="primary-button small"
                type="submit"
                disabled={callBusyId === editingCall.id || !callTitleDraft.trim()}
              >
                <Check size={15} />
                Сохранить
              </button>
              <button className="ghost-button small" type="button" onClick={cancelCallRename}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
      {pendingDeleteCopy && (
        <ConfirmDialog
          open
          variant="danger"
          title={pendingDeleteCopy.title}
          message={pendingDeleteCopy.message}
          confirmLabel="Удалить"
          busy={pendingDeleteBusy}
          onCancel={() => {
            if (!pendingDeleteBusy) setPendingDelete(null);
          }}
          onConfirm={() => void confirmPendingDelete()}
        />
      )}
    </section>
  );
}

type PendingDelete =
  | { type: "call"; call: CallResponse }
  | { type: "folder"; folder: CallFolderResponse }
  | null;

type FolderFormState = {
  scope: VisibilityScope;
  company_uuid: string;
  department_uuid: string;
  name: string;
  description: string;
  color: string;
  instruction_uuids: string[];
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
    ,instruction_uuids: []
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
        ,instruction_uuids: form.instruction_uuids
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
      ,instruction_uuids: form.instruction_uuids
    }
  };
}
