import {
  Check,
  Download,
  FileBarChart2,
  FileDown,
  Plus,
  RefreshCcw,
  Search,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, openAuthorizedEventStream } from "../../api";
import type {
  AggregateAnalysisResponse,
  AggregateAnalysisResult,
  AggregateAnalysisStatus,
  AggregateAnalysisStatusEvent,
  AggregateReportResponse,
  AnalysisResponse,
  CallFolderResponse,
  CallResponse,
  CompanyResponse,
  CreateDeepAnalysisRequest,
  DeepAnalysisScope,
  DepartmentResponse,
  ReportFormat,
  ReportStatus,
  ReportWithCallResponse
} from "../../types";
import {
  confidenceLabels,
  enumLabel,
  priorityLabels,
  severityLabels
} from "../../shared/lib/analysis";
import { isAnalysisDone } from "../../shared/lib/analysis";
import { formatBytes, formatDate, reportFormatLabel, reportStatusLabel } from "../../shared/lib/formatters";
import { SelectControl } from "../../shared/ui/primitives";
import { aggregateResult, callCountLabel, formatShare, shortIdentifier } from "./aggregate-analysis";
import { reportFormats } from "./ReportExportPanel";

type ReportsTab = "call" | "deep";

function readReportsTabFromLocation(): ReportsTab {
  return new URLSearchParams(window.location.search).get("tab") === "deep" ? "deep" : "call";
}

type DeepAnalysisFormState = {
  scope: DeepAnalysisScope;
  company_uuid: string;
  department_uuid: string;
  folder_uuid: string;
  period_from: string;
  period_to: string;
  force: boolean;
};

export function AiReportsPage({
  calls,
  analyses,
  companies,
  departments
}: {
  calls: CallResponse[];
  analyses: Record<string, AnalysisResponse>;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
}) {
  const [activeTab, setActiveTab] = useState<ReportsTab>(() => readReportsTabFromLocation());
  const [reports, setReports] = useState<ReportWithCallResponse[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [formatFilter, setFormatFilter] = useState<ReportFormat | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("pdf");
  const [selectedCallId, setSelectedCallId] = useState("");
  const [callQuery, setCallQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyReportId, setBusyReportId] = useState("");
  const [deepAnalyses, setDeepAnalyses] = useState<AggregateAnalysisResponse[]>([]);
  const [loadingDeepAnalyses, setLoadingDeepAnalyses] = useState(false);
  const [deepStatusFilter, setDeepStatusFilter] = useState<AggregateAnalysisStatus | "all">("all");
  const [selectedDeepAnalysisId, setSelectedDeepAnalysisId] = useState("");
  const [deepActionError, setDeepActionError] = useState("");
  const [deepBusy, setDeepBusy] = useState(false);
  const [deepFolders, setDeepFolders] = useState<CallFolderResponse[]>([]);
  const [loadingDeepFolders, setLoadingDeepFolders] = useState(false);
  const [deepFoldersError, setDeepFoldersError] = useState("");
  const [aggregateReports, setAggregateReports] = useState<AggregateReportResponse[]>([]);
  const [loadingAggregateReports, setLoadingAggregateReports] = useState(false);
  const [selectedAggregateFormat, setSelectedAggregateFormat] = useState<ReportFormat>("pdf");
  const [busyAggregateReportId, setBusyAggregateReportId] = useState("");
  const [deepForm, setDeepForm] = useState<DeepAnalysisFormState>(() => defaultDeepForm());
  const readyAnalyses = useMemo(
    () => calls.filter((call) => isAnalysisDone(analyses[call.id])),
    [analyses, calls]
  );
  const filteredReadyAnalyses = useMemo(() => {
    const query = callQuery.trim().toLowerCase();
    if (!query) return readyAnalyses.slice(0, 6);

    return readyAnalyses
      .filter((call) => reportCallSearchText(call).includes(query))
      .slice(0, 6);
  }, [callQuery, readyAnalyses]);
  const selectedCall = readyAnalyses.find((call) => call.id === selectedCallId) ?? readyAnalyses[0];
  const selectedDeepAnalysis =
    deepAnalyses.find((analysis) => analysis.id === selectedDeepAnalysisId) ?? deepAnalyses[0];
  const processingReports = calls.filter((call) => call.status === "processing").length;
  const latestReport = reports[0];
  const doneDeepCount = deepAnalyses.filter((analysis) => analysis.status === "done").length;
  const activeDeepCount = deepAnalyses.filter((analysis) =>
    analysis.status === "pending" || analysis.status === "processing"
  ).length;
  const activeDeepAnalysisIds = useMemo(
    () =>
      deepAnalyses
        .filter((analysis) => analysis.status === "pending" || analysis.status === "processing")
        .map((analysis) => analysis.id)
        .sort()
        .join("|"),
    [deepAnalyses]
  );
  const formDepartmentOptions = departments.filter((department) => department.company_uuid === deepForm.company_uuid);
  const companiesFolderKey = companies.map((company) => company.id).join("|");
  const departmentsFolderKey = departments.map((department) => `${department.company_uuid}:${department.id}`).join("|");

  function changeReportsTab(tab: ReportsTab) {
    setActiveTab(tab);

    const url = new URL(window.location.href);
    if (tab === "deep") {
      url.searchParams.set("tab", "deep");
    } else {
      url.searchParams.delete("tab");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    if (selectedCallId && readyAnalyses.some((call) => call.id === selectedCallId)) return;
    setSelectedCallId(readyAnalyses[0]?.id ?? "");
  }, [readyAnalyses, selectedCallId]);

  useEffect(() => {
    const onPopState = () => setActiveTab(readReportsTabFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoadingReports(true);
      const response = await api
        .listGlobalReports({
          format: formatFilter === "all" ? undefined : formatFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
          sort: "created_at",
          order: "desc",
          limit: 50,
          offset: 0
        })
        .catch(() => null);

      if (!cancelled) {
        setReports(response?.reports ?? []);
        setLoadingReports(false);
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [formatFilter, statusFilter]);

  useEffect(() => {
    if (activeTab !== "deep") return;
    void loadDeepAnalyses();
  }, [activeTab, deepStatusFilter]);

  useEffect(() => {
    if (activeTab !== "deep" || !activeDeepAnalysisIds) return;

    const sources = activeDeepAnalysisIds.split("|").map((analysisId) => {
      const source = openAuthorizedEventStream(api.getDeepAnalysisEventsUrl(analysisId));

      source.addEventListener("status", (event) => {
        const statusEvent = parseDeepAnalysisStatusEvent(event);
        if (!statusEvent || statusEvent.analysis_id !== analysisId) return;

        setDeepAnalyses((current) =>
          current.map((analysis) =>
            analysis.id === analysisId && analysis.status !== statusEvent.status
              ? { ...analysis, status: statusEvent.status, updated_at: statusEvent.timestamp }
              : analysis
          )
        );

        if (statusEvent.terminal) {
          source.close();
          void loadDeepAnalyses();
        }
      });

      source.addEventListener("error", (event) => {
        source.close();
        void loadDeepAnalyses();
      });

      return source;
    });

    return () => {
      sources.forEach((source) => source.close());
    };
  }, [activeTab, activeDeepAnalysisIds, deepStatusFilter]);

  useEffect(() => {
    if (
      activeTab !== "deep" ||
      !selectedDeepAnalysis?.id ||
      (selectedDeepAnalysis.status !== "pending" && selectedDeepAnalysis.status !== "processing")
    ) {
      return;
    }

    let cancelled = false;

    async function refreshSelectedAnalysis() {
      try {
        const refreshed = await api.getDeepAnalysis(selectedDeepAnalysis.id);
        if (cancelled) return;
        setDeepAnalyses((current) => upsertDeepAnalysis(current, refreshed));
      } catch (error) {
        if (!cancelled) {
          setDeepActionError(error instanceof Error ? error.message : "Не удалось обновить статус глубокого анализа.");
        }
      }
    }

    const timer = window.setInterval(() => void refreshSelectedAnalysis(), 12_000);
    void refreshSelectedAnalysis();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTab, selectedDeepAnalysis?.id, selectedDeepAnalysis?.status]);

  useEffect(() => {
    if (activeTab !== "deep") return;
    let cancelled = false;

    async function loadFolders() {
      setLoadingDeepFolders(true);
      setDeepFoldersError("");

      try {
        const response = await loadCallFoldersForContext(companies, departments);
        if (!cancelled) {
          setDeepFolders(response.items);
          setDeepFoldersError(response.error ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setDeepFolders([]);
          setDeepFoldersError(error instanceof Error ? error.message : "Не удалось загрузить папки звонков.");
        }
      } finally {
        if (!cancelled) {
          setLoadingDeepFolders(false);
        }
      }
    }

    loadFolders();

    return () => {
      cancelled = true;
    };
  }, [activeTab, companiesFolderKey, departmentsFolderKey]);

  useEffect(() => {
    setSelectedDeepAnalysisId((current) =>
      current && deepAnalyses.some((analysis) => analysis.id === current)
        ? current
        : deepAnalyses[0]?.id ?? ""
    );
  }, [deepAnalyses]);

  useEffect(() => {
    if (!selectedDeepAnalysis) {
      setAggregateReports([]);
      return;
    }

    void loadAggregateReports(selectedDeepAnalysis.id);
  }, [selectedDeepAnalysis?.id]);

  async function loadDeepAnalyses() {
    setLoadingDeepAnalyses(true);
    setDeepActionError("");
    try {
      const response = await api.listDeepAnalyses({
        status: deepStatusFilter === "all" ? undefined : deepStatusFilter,
        limit: 50,
        offset: 0
      });
      setDeepAnalyses(response.items);
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось загрузить глубокий анализ.");
      setDeepAnalyses([]);
    } finally {
      setLoadingDeepAnalyses(false);
    }
  }

  async function loadAggregateReports(analysisId: string) {
    setLoadingAggregateReports(true);
    try {
      const response = await api.listAggregateReports(analysisId);
      setAggregateReports(response.reports);
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось загрузить отчеты глубокого анализа.");
      setAggregateReports([]);
    } finally {
      setLoadingAggregateReports(false);
    }
  }

  async function selectDeepAnalysis(analysisId: string) {
    setSelectedDeepAnalysisId(analysisId);
    setDeepActionError("");

    try {
      const analysis = await api.getDeepAnalysis(analysisId);
      setDeepAnalyses((current) => upsertDeepAnalysis(current, analysis));
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось загрузить глубокий анализ.");
    }
  }

  async function createCallReport() {
    if (!selectedCall) {
      setActionError("Нет звонка с готовым анализом для отчета.");
      return;
    }

    setActionError("");
    try {
      await api.createGlobalReport({ scope: "call", call_uuid: selectedCall.id, format: selectedFormat });
      const response = await api.listGlobalReports({ limit: 50, sort: "created_at", order: "desc" });
      setReports(response.reports);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось создать отчет.");
    }
  }

  async function downloadReport(report: ReportWithCallResponse) {
    setActionError("");
    setBusyReportId(report.id);
    try {
      const blob = await api.downloadReport(report);
      saveBlob(blob, report.file_name || `ai-report-${report.id}.${report.format}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось скачать отчет.");
    } finally {
      setBusyReportId("");
    }
  }

  async function deleteReport(report: ReportWithCallResponse) {
    setActionError("");
    setBusyReportId(report.id);
    try {
      await api.deleteReport(report.id);
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось удалить отчет.");
    } finally {
      setBusyReportId("");
    }
  }

  async function createDeepAnalysis() {
    const payload = buildDeepAnalysisPayload(deepForm);
    if (!payload.ok) {
      setDeepActionError(payload.error);
      return;
    }

    setDeepActionError("");
    setDeepBusy(true);
    try {
      const created = await api.createDeepAnalysis(payload.value);
      setSelectedDeepAnalysisId(created.id);
      setDeepAnalyses((current) => upsertDeepAnalysis(current, created));
      await loadDeepAnalyses();
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось создать глубокий анализ.");
    } finally {
      setDeepBusy(false);
    }
  }

  async function createAggregateReport() {
    if (!selectedDeepAnalysis) return;

    setDeepActionError("");
    setBusyAggregateReportId("create");
    try {
      await api.createAggregateReport(selectedDeepAnalysis.id, selectedAggregateFormat);
      await loadAggregateReports(selectedDeepAnalysis.id);
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось создать отчет глубокого анализа.");
    } finally {
      setBusyAggregateReportId("");
    }
  }

  async function downloadAggregateReport(report: AggregateReportResponse) {
    setDeepActionError("");
    setBusyAggregateReportId(report.id);
    try {
      const blob = await api.downloadAggregateReport(report);
      saveBlob(blob, report.file_name || `deep-analysis-${report.id}.${report.format}`);
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось скачать отчет глубокого анализа.");
    } finally {
      setBusyAggregateReportId("");
    }
  }

  async function deleteAggregateReport(report: AggregateReportResponse) {
    setDeepActionError("");
    setBusyAggregateReportId(report.id);
    try {
      await api.deleteAggregateReport(report.id);
      setAggregateReports((current) => current.filter((item) => item.id !== report.id));
    } catch (error) {
      setDeepActionError(error instanceof Error ? error.message : "Не удалось удалить отчет глубокого анализа.");
    } finally {
      setBusyAggregateReportId("");
    }
  }

  return (
    <section className="reports-page app-page">
      <div className="app-page-heading readable-heading">
        <h1>AI-отчеты</h1>
        <p>Экспорт, статусы, история отчетов и глубокий анализ выбранных периодов.</p>
      </div>

      <div className="report-tabs segmented scope" aria-label="Разделы отчетов">
        <button className={activeTab === "call" ? "active" : ""} type="button" onClick={() => changeReportsTab("call")}>
          Отчеты по звонкам
        </button>
        <button className={activeTab === "deep" ? "active" : ""} type="button" onClick={() => changeReportsTab("deep")}>
          Глубокий анализ
        </button>
      </div>

      {activeTab === "call" ? (
        <>
          <div className="reports-kpi-grid">
            <ReportMetric value={readyAnalyses.length.toString()} label="Отчетов доступно" note="по готовым анализам" />
            <ReportMetric value={processingReports.toString()} label="В очереди" note="звонки в обработке" />
            <ReportMetric
              value={loadingReports ? "..." : latestReport ? reportFormatLabel(latestReport.format) : "—"}
              label="Последний экспорт"
              note={
                loadingReports
                  ? "проверяю историю"
                  : latestReport
                    ? `${reportStatusLabel(latestReport.status)} · ${formatDate(latestReport.created_at)}`
                    : readyAnalyses.length > 0
                      ? "экспорт еще не создавался"
                      : "нет готового анализа"
              }
            />
            <ReportMetric value={reportFormats.length.toString()} label="Доступно форматов" note={reportFormats.map((item) => item.label).join(", ")} />
          </div>
          <CallReportsSection
            reports={reports}
            loadingReports={loadingReports}
            formatFilter={formatFilter}
            statusFilter={statusFilter}
            selectedFormat={selectedFormat}
            selectedCall={selectedCall}
            filteredReadyAnalyses={filteredReadyAnalyses}
            callQuery={callQuery}
            readyAnalysesCount={readyAnalyses.length}
            actionError={actionError}
            busyReportId={busyReportId}
            onFormatFilterChange={setFormatFilter}
            onStatusFilterChange={setStatusFilter}
            onSelectedFormatChange={setSelectedFormat}
            onCallQueryChange={setCallQuery}
            onSelectedCallChange={setSelectedCallId}
            onCreateCallReport={createCallReport}
            onDownloadReport={downloadReport}
            onDeleteReport={deleteReport}
          />
        </>
      ) : (
        <>
          <div className="reports-kpi-grid">
            <ReportMetric value={deepAnalyses.length.toString()} label="Глубоких анализов" note="в текущей истории" />
            <ReportMetric value={doneDeepCount.toString()} label="Готово" note="можно экспортировать" />
            <ReportMetric value={activeDeepCount.toString()} label="Формируется" note="ожидают завершения" />
            <ReportMetric value={deepFolders.length.toString()} label="Папок доступно" note={loadingDeepFolders ? "загружаю" : "для анализа папок"} />
          </div>
          <DeepAnalysisSection
            companies={companies}
            departments={departments}
            folders={deepFolders}
            foldersLoading={loadingDeepFolders}
            foldersError={deepFoldersError}
            formDepartmentOptions={formDepartmentOptions}
            form={deepForm}
            analyses={deepAnalyses}
            selectedAnalysis={selectedDeepAnalysis}
            aggregateReports={aggregateReports}
            loadingAnalyses={loadingDeepAnalyses}
            loadingReports={loadingAggregateReports}
            statusFilter={deepStatusFilter}
            selectedAggregateFormat={selectedAggregateFormat}
            actionError={deepActionError}
            busy={deepBusy}
            busyReportId={busyAggregateReportId}
            onFormChange={setDeepForm}
            onStatusFilterChange={setDeepStatusFilter}
            onSelectAnalysis={selectDeepAnalysis}
            onCreateAnalysis={createDeepAnalysis}
            onRefreshAnalyses={loadDeepAnalyses}
            onAggregateFormatChange={setSelectedAggregateFormat}
            onCreateAggregateReport={createAggregateReport}
            onDownloadAggregateReport={downloadAggregateReport}
            onDeleteAggregateReport={deleteAggregateReport}
          />
        </>
      )}
    </section>
  );
}

function CallReportsSection({
  reports,
  loadingReports,
  formatFilter,
  statusFilter,
  selectedFormat,
  selectedCall,
  filteredReadyAnalyses,
  callQuery,
  readyAnalysesCount,
  actionError,
  busyReportId,
  onFormatFilterChange,
  onStatusFilterChange,
  onSelectedFormatChange,
  onCallQueryChange,
  onSelectedCallChange,
  onCreateCallReport,
  onDownloadReport,
  onDeleteReport
}: {
  reports: ReportWithCallResponse[];
  loadingReports: boolean;
  formatFilter: ReportFormat | "all";
  statusFilter: ReportStatus | "all";
  selectedFormat: ReportFormat;
  selectedCall?: CallResponse;
  filteredReadyAnalyses: CallResponse[];
  callQuery: string;
  readyAnalysesCount: number;
  actionError: string;
  busyReportId: string;
  onFormatFilterChange: (format: ReportFormat | "all") => void;
  onStatusFilterChange: (status: ReportStatus | "all") => void;
  onSelectedFormatChange: (format: ReportFormat) => void;
  onCallQueryChange: (query: string) => void;
  onSelectedCallChange: (callId: string) => void;
  onCreateCallReport: () => void;
  onDownloadReport: (report: ReportWithCallResponse) => void;
  onDeleteReport: (report: ReportWithCallResponse) => void;
}) {
  return (
    <div className="reports-grid">
      <section className="glass-panel entity-list-panel">
        <div className="panel-heading large">
          <div>
            <h2>История AI-отчетов</h2>
            <p>Здесь показаны только реально созданные экспорты.</p>
          </div>
        </div>
        <div className="calls-filter-bar report-history-filters">
          <SelectControl
            aria-label="Формат AI-отчетов"
            value={formatFilter}
            onChange={(event) => onFormatFilterChange(event.target.value as ReportFormat | "all")}
          >
            <option value="all">Все форматы</option>
            {reportFormats.map((item) => (
              <option key={item.format} value={item.format}>{item.label}</option>
            ))}
          </SelectControl>
          <SelectControl
            aria-label="Статус AI-отчетов"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as ReportStatus | "all")}
          >
            <option value="all">Все статусы</option>
            <option value="pending">В очереди</option>
            <option value="ready">Готов</option>
            <option value="failed">Ошибка</option>
          </SelectControl>
        </div>
        <div className="report-placeholder-list">
          {loadingReports ? (
            <div className="report-placeholder-row">
              <FileBarChart2 size={22} />
              <div>
                <strong>Загружаю отчеты</strong>
                <small>Запрос к /reports</small>
              </div>
            </div>
          ) : reports.length > 0 ? (
            reports.slice(0, 8).map((report) => {
              const call = report.call;

              return (
                <div className="report-placeholder-row report-history-row" key={report.id}>
                  <FileBarChart2 size={22} />
                  <div>
                    <strong>{reportFormatLabel(report.format)} · {call?.title ?? "Звонок"}</strong>
                    <small>Создан {formatDate(report.created_at)} · {reportFileLabel(report.file_name)}</small>
                  </div>
                  <span className={`status-dot ${report.status === "ready" ? "ok" : report.status === "failed" ? "bad" : "warn"}`}>
                    {reportStatusLabel(report.status)}
                  </span>
                  <div className="report-row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Скачать отчет"
                      disabled={busyReportId === report.id || report.status !== "ready"}
                      onClick={() => onDownloadReport(report)}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label="Удалить отчет"
                      disabled={busyReportId === report.id}
                      onClick={() => onDeleteReport(report)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="report-placeholder-row empty">
              <FileBarChart2 size={22} />
              <div>
                <strong>Созданных AI-отчетов пока нет</strong>
                <small>
                  {readyAnalysesCount > 0
                    ? "Выберите создание отчета справа, чтобы сформировать первый экспорт."
                    : "Отчет можно создать после готового AI-анализа звонка."}
                </small>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="glass-panel entity-detail-panel">
        <FileDown size={34} />
        <h2>Новый AI-отчет</h2>
        <p>Выберите звонок с готовым AI-анализом и формат отчета.</p>
        {actionError && <div className="form-error">{actionError}</div>}
        <div className="report-call-picker">
          <label>
            Звонок для отчета
            <span className="report-call-search">
              <Search size={16} />
              <input
                value={callQuery}
                onChange={(event) => onCallQueryChange(event.target.value)}
                placeholder="Найти звонок по названию"
              />
            </span>
          </label>
          <div className="report-call-options">
            {filteredReadyAnalyses.length === 0 ? (
              <div className="report-call-option empty">Готовых анализов по поиску нет</div>
            ) : (
              filteredReadyAnalyses.map((call) => (
                <button
                  className={`report-call-option ${selectedCall?.id === call.id ? "active" : ""}`}
                  type="button"
                  key={call.id}
                  onClick={() => {
                    onSelectedCallChange(call.id);
                    onCallQueryChange(call.title);
                  }}
                >
                  <strong>{call.title}</strong>
                  <small>{formatDate(call.created_at)} · {call.original_filename}</small>
                </button>
              ))
            )}
          </div>
        </div>
        <button className="primary-button" type="button" disabled={!selectedCall} onClick={onCreateCallReport}>
          <Plus size={17} />
          Создать {reportFormatLabel(selectedFormat)}
        </button>
        <div className="report-format-actions">
          {reportFormats.map((item) => (
            <button
              className={`report-action-row ${selectedFormat === item.format ? "active" : ""}`}
              type="button"
              key={item.format}
              onClick={() => onSelectedFormatChange(item.format)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function DeepAnalysisSection({
  companies,
  departments,
  folders,
  foldersLoading,
  foldersError,
  formDepartmentOptions,
  form,
  analyses,
  selectedAnalysis,
  aggregateReports,
  loadingAnalyses,
  loadingReports,
  statusFilter,
  selectedAggregateFormat,
  actionError,
  busy,
  busyReportId,
  onFormChange,
  onStatusFilterChange,
  onSelectAnalysis,
  onCreateAnalysis,
  onRefreshAnalyses,
  onAggregateFormatChange,
  onCreateAggregateReport,
  onDownloadAggregateReport,
  onDeleteAggregateReport
}: {
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  folders: CallFolderResponse[];
  foldersLoading: boolean;
  foldersError: string;
  formDepartmentOptions: DepartmentResponse[];
  form: DeepAnalysisFormState;
  analyses: AggregateAnalysisResponse[];
  selectedAnalysis?: AggregateAnalysisResponse;
  aggregateReports: AggregateReportResponse[];
  loadingAnalyses: boolean;
  loadingReports: boolean;
  statusFilter: AggregateAnalysisStatus | "all";
  selectedAggregateFormat: ReportFormat;
  actionError: string;
  busy: boolean;
  busyReportId: string;
  onFormChange: (form: DeepAnalysisFormState) => void;
  onStatusFilterChange: (status: AggregateAnalysisStatus | "all") => void;
  onSelectAnalysis: (analysisId: string) => void;
  onCreateAnalysis: () => void;
  onRefreshAnalyses: () => void;
  onAggregateFormatChange: (format: ReportFormat) => void;
  onCreateAggregateReport: () => void;
  onDownloadAggregateReport: (report: AggregateReportResponse) => void;
  onDeleteAggregateReport: (report: AggregateReportResponse) => void;
}) {
  const selectedContext = selectedAnalysis
    ? deepAnalysisContext(selectedAnalysis, companies, departments, folders)
    : null;
  const selectedFolder = folders.find((folder) => folder.id === form.folder_uuid);

  return (
    <div className="deep-analysis-grid">
      <section className="glass-panel deep-analysis-form-panel">
        <div className="panel-heading large deep-analysis-form-heading">
          <div>
            <h2>Создать глубокий анализ</h2>
            <p>Соберите сводку по готовым анализам звонков за выбранный период.</p>
          </div>
          <label className={`deep-force-toggle ${form.force ? "checked" : ""}`}>
            <input
              className="deep-force-input"
              type="checkbox"
              checked={form.force}
              onChange={(event) => onFormChange({ ...form, force: event.target.checked })}
            />
            <span className="deep-force-box" aria-hidden="true">
              {form.force && <Check size={15} />}
            </span>
            <span>
              <strong>Создать заново и потратить недельный лимит</strong>
              <small>Если за этот период уже есть успешный анализ, он будет использован повторно.</small>
            </span>
          </label>
        </div>
        {actionError && <div className="form-error">{friendlyDeepActionError(actionError)}</div>}
        <div className="deep-analysis-form">
          <label>
            Область
            <SelectControl
              aria-label="Область глубокого анализа"
              value={form.scope}
              onChange={(event) => {
                const scope = event.target.value as DeepAnalysisScope;
                const companyId = scope === "personal" || scope === "folder" ? "" : form.company_uuid || companies[0]?.id || "";
                const departmentId =
                  scope === "department"
                    ? form.department_uuid || departments.find((department) => department.company_uuid === companyId)?.id || ""
                    : "";
                onFormChange({
                  ...form,
                  scope,
                  company_uuid: companyId,
                  department_uuid: departmentId,
                  folder_uuid: scope === "folder" ? form.folder_uuid : ""
                });
              }}
            >
              <option value="personal">Лично</option>
              {companies.length > 0 && <option value="company">Компания</option>}
              {companies.length > 0 && <option value="department">Отдел</option>}
              <option value="folder">Папка</option>
            </SelectControl>
          </label>
          {(form.scope === "company" || form.scope === "department") && (
            <label>
              Компания
              <SelectControl
                aria-label="Компания глубокого анализа"
                value={form.company_uuid}
                onChange={(event) => {
                  const companyId = event.target.value;
                  onFormChange({
                    ...form,
                    company_uuid: companyId,
                    department_uuid:
                      form.scope === "department"
                        ? departments.find((department) => department.company_uuid === companyId)?.id ?? ""
                        : ""
                  });
                }}
              >
                <option value="">Выберите компанию</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </SelectControl>
            </label>
          )}
          {form.scope === "department" && (
            <label>
              Отдел
              <SelectControl
                aria-label="Отдел глубокого анализа"
                value={form.department_uuid}
                onChange={(event) => onFormChange({ ...form, department_uuid: event.target.value })}
              >
                <option value="">Выберите отдел</option>
                {formDepartmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </SelectControl>
            </label>
          )}
          {form.scope === "folder" && (
            <label>
              Папка
              <SelectControl
                aria-label="Папка глубокого анализа"
                value={form.folder_uuid}
                onChange={(event) => onFormChange({ ...form, folder_uuid: event.target.value })}
              >
                <option value="">Выберите папку</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name} · {folder.color || "без цвета"} · {callCountLabel(folder.calls_count)}
                  </option>
                ))}
              </SelectControl>
              {foldersLoading ? (
                <small>Загружаю папки выбранных областей.</small>
              ) : foldersError ? (
                <small className="report-error">{foldersError}</small>
              ) : selectedFolder ? (
                <small className="deep-folder-preview">
                  <span
                    className="folder-color-dot"
                    style={{ backgroundColor: selectedFolder.color || "var(--app-border)" }}
                    aria-hidden="true"
                  />
                  {deepScopeLabel(selectedFolder.scope)} · {callCountLabel(selectedFolder.calls_count)}
                </small>
              ) : folders.length === 0 ? (
                <small>В доступных областях пока нет папок.</small>
              ) : null}
            </label>
          )}
          <div className="deep-period-grid">
            <label>
              Начало периода
              <input
                type="date"
                value={form.period_from}
                onChange={(event) => onFormChange({ ...form, period_from: event.target.value })}
              />
            </label>
            <label>
              Конец периода
              <input
                type="date"
                value={form.period_to}
                onChange={(event) => onFormChange({ ...form, period_to: event.target.value })}
              />
            </label>
          </div>
          <div className="deep-create-actions">
            <button className="primary-button deep-create-button" type="button" disabled={busy} onClick={onCreateAnalysis}>
              <Plus size={17} />
              {busy ? "Создаю..." : "Создать глубокий анализ"}
            </button>
          </div>
        </div>
      </section>

      <div className="deep-analysis-content-grid">
        <section className="glass-panel entity-list-panel deep-analysis-history-panel">
          <div className="panel-heading large">
            <div>
              <h2>История глубокого анализа</h2>
              <p>Статусы обновляются автоматически; при необходимости обновите список вручную.</p>
            </div>
            <button className="ghost-button small" type="button" disabled={loadingAnalyses} aria-busy={loadingAnalyses} onClick={onRefreshAnalyses}>
              <RefreshCcw className={loadingAnalyses ? "refresh-icon spinning" : "refresh-icon"} size={16} />
              {loadingAnalyses ? "Обновляю" : "Обновить"}
            </button>
          </div>
          <div className="calls-filter-bar">
            <SelectControl
              aria-label="Статус глубокого анализа"
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as AggregateAnalysisStatus | "all")}
            >
              <option value="all">Все статусы</option>
              <option value="pending">В очереди</option>
              <option value="processing">Формируется</option>
              <option value="done">Готов</option>
              <option value="failed">Ошибка</option>
            </SelectControl>
          </div>
          <div className="report-placeholder-list deep-analysis-history">
            {loadingAnalyses && analyses.length === 0 ? (
              <div className="report-placeholder-row">
                <FileBarChart2 size={22} />
                <div>
                  <strong>Загружаю глубокие анализы</strong>
                  <small>Собираю историю за выбранным фильтром.</small>
                </div>
              </div>
            ) : analyses.length === 0 ? (
              <div className="report-placeholder-row empty">
                <FileBarChart2 size={22} />
                <div>
                  <strong>История пока пустая</strong>
                  <small>Создайте анализ за период с готовыми AI-анализами звонков.</small>
                </div>
              </div>
            ) : (
              analyses.map((analysis) => {
                const context = deepAnalysisContext(analysis, companies, departments, folders);
                const providerModel = [analysis.provider, analysis.model].filter(
                  (value): value is string => typeof value === "string" && value.trim().length > 0
                ).join(" · ");

                return (
                  <button
                    className={`deep-analysis-row ${selectedAnalysis?.id === analysis.id ? "selected" : ""}`}
                    type="button"
                    key={analysis.id}
                    onClick={() => onSelectAnalysis(analysis.id)}
                  >
                    <span className={`status-chip ${analysis.status === "done" ? "ok" : analysis.status === "failed" ? "bad" : "warn"}`}>
                      {aggregateStatusLabel(analysis.status)}
                    </span>
                    <div>
                      <strong>{context.title} · {callCountLabel(analysis.source_calls_count)}</strong>
                      <small>Период: {dateOnly(analysis.period_from)} - {dateOnly(analysis.period_to)}</small>
                      <small>Создан: {formatDate(analysis.created_at)}</small>
                      {providerModel && <small>Модель: {providerModel}</small>}
                      {context.details && <small>{context.details}</small>}
                      {analysis.error_message && (
                        <small className="report-error">{friendlyDeepAnalysisError(analysis.error_message)}</small>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="glass-panel entity-detail-panel deep-analysis-result-panel">
          {selectedAnalysis && selectedContext ? (
            <>
              <div className="panel-heading large">
                <div>
                  <h2>Результат глубокого анализа</h2>
                  <p>
                    {selectedContext.title} · {dateOnly(selectedAnalysis.period_from)} -{" "}
                    {dateOnly(selectedAnalysis.period_to)}
                  </p>
                </div>
                <span className={`status-chip ${selectedAnalysis.status === "done" ? "ok" : selectedAnalysis.status === "failed" ? "bad" : "warn"}`}>
                  {aggregateStatusLabel(selectedAnalysis.status)}
                </span>
              </div>
              {selectedAnalysis.status === "done" ? (
                <AggregateResultView analysis={selectedAnalysis} />
              ) : selectedAnalysis.status === "failed" ? (
                <div className="form-error">{friendlyDeepAnalysisError(selectedAnalysis.error_message)}</div>
              ) : (
                <div className="empty-state compact">Глубокий анализ формируется. Обновите историю позже.</div>
              )}
            </>
          ) : (
            <div className="empty-panel compact">
              <FileBarChart2 size={28} />
              <p>Выберите глубокий анализ из истории.</p>
            </div>
          )}
        </section>
      </div>

      {selectedAnalysis && (
        <AggregateReportsPanel
          analysis={selectedAnalysis}
          reports={aggregateReports}
          loading={loadingReports}
          selectedFormat={selectedAggregateFormat}
          busyReportId={busyReportId}
          onFormatChange={onAggregateFormatChange}
          onCreate={onCreateAggregateReport}
          onDownload={onDownloadAggregateReport}
          onDelete={onDeleteAggregateReport}
        />
      )}
      {!selectedAnalysis && (
        <section className="glass-panel aggregate-report-panel deep-analysis-export-panel">
          <div className="card-title">
            <div>
              <h3>Экспорт глубокого анализа</h3>
              <p>Выберите анализ из истории, чтобы подготовить PDF, DOCX, Markdown или Excel.</p>
            </div>
          </div>
          <div className="empty-state compact">Экспорт станет доступен после выбора анализа.</div>
        </section>
        )}
    </div>
  );
}

function AggregateResultView({ analysis }: { analysis: AggregateAnalysisResponse; }) {
  const result = aggregateResult(analysis.result_json);

  if (!result) {
    return (
      <div className="analysis-structured">
        <div className="analysis-section">
          <strong>Результат</strong>
          <p>{analysis.result_text || "Структурированный результат пока недоступен."}</p>
        </div>
      </div>
    );
  }

  const recurringIssues = result.recurring_issues.filter((issue) => (issue.count ?? 0) >= 2);
  const oneOffFromLegacyRecurring = result.recurring_issues
    .filter((issue) => (issue.count ?? 0) < 2)
    .map((issue) => ({
      code: issue.code,
      title: issue.title,
      description: issue.recommendation,
      affected_calls_count: issue.count,
      affected_share: issue.affected_share,
      sample_call_uuids: issue.sample_call_uuids,
      recommendation: issue.recommendation,
      count: issue.count
    }));
  const singleCallObservations = [
    ...(result.single_call_observations ?? []),
    ...oneOffFromLegacyRecurring
  ];
  const systemicIssues = result.systemic_issues?.length
    ? result.systemic_issues
    : result.key_findings.map((finding) => ({
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        affected_calls_count: finding.affected_calls_count,
        affected_share: finding.affected_share,
        evidence_call_uuids: finding.evidence_call_uuids
      }));
  const executiveSummary =
    result.executive_summary || result.overall_assessment || result.summary || analysis.result_text || "Резюме не указано.";

  return (
    <div className="analysis-structured aggregate-result">
      <AggregateSourceCoverage
        analysis={analysis}
        source={result.source_summary}
        coverageNote={result.coverage_note}
      />
      <div className="analysis-section">
        <strong>Резюме для руководителя</strong>
        <p>{executiveSummary}</p>
        {result.overall_assessment && result.overall_assessment !== executiveSummary && (
          <p className="aggregate-secondary-text">{result.overall_assessment}</p>
        )}
        {result.summary && result.summary !== executiveSummary && result.summary !== result.overall_assessment && (
          <p className="aggregate-secondary-text">{result.summary}</p>
        )}
        <small>Уверенность: {(enumLabel(result.confidence, confidenceLabels) ?? result.confidence) || "Не указана"}</small>
      </div>
      <AggregateDetailedReportView report={result.detailed_report} />
      <AggregateIssueDetailList
        title="Системные проблемы"
        items={systemicIssues}
        emptyLabel="Системные проблемы не указаны."
      />
      {result.systemic_issues?.length ? <AggregateFindingList items={result.key_findings} /> : null}
      <div className="analysis-section">
        <strong>Повторяющиеся проблемы</strong>
        {recurringIssues.length === 0 ? (
          <p className="analysis-empty">Повторяющиеся проблемы не указаны.</p>
        ) : (
          <div className="analytics-list">
            {recurringIssues.map((issue) => (
              <div className="analytics-list-row criteria" key={`${issue.code}-${issue.title}`}>
                <div>
                  <strong>{issue.title || issue.code || "Повторяющийся сигнал"}</strong>
                  <small>{issue.recommendation || "Рекомендация не указана"}</small>
                  {issue.sample_call_uuids?.length ? <UuidSamples values={issue.sample_call_uuids} /> : null}
                </div>
                <span>
                  {issue.count ?? "—"}
                  {issue.affected_share !== undefined ? ` · ${formatShare(issue.affected_share)}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <AggregateIssueDetailList
        title="Единичные, но важные сигналы"
        items={singleCallObservations}
        emptyLabel="Единичные важные сигналы не указаны."
      />
      <AggregateMetricDetailList
        title="Слабые критерии"
        items={result.weak_criteria ?? []}
        emptyLabel="Слабые критерии не указаны."
      />
      <AggregateMetricDetailList
        title="Возражения клиентов"
        items={result.client_objections ?? []}
        emptyLabel="Отдельные возражения не указаны."
      />
      <AggregateIssueDetailList
        title="Паттерны потерь и рисков"
        items={result.loss_and_risk_patterns ?? []}
        emptyLabel="Паттерны потерь и рисков не указаны."
      />
      <div className="analysis-section">
        <strong>Сильные стороны, риски и рекомендации</strong>
        <div className="analysis-columns">
          <div>
            <strong>Сильные стороны</strong>
            <AggregateStringList items={result.strengths} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Риски</strong>
            <AggregateStringList items={result.risks} emptyLabel="Не указаны" />
          </div>
          <div>
            <strong>Рекомендации менеджерам</strong>
            <AggregateStringList items={result.manager_recommendations} emptyLabel="Не указаны" />
          </div>
        </div>
      </div>
      <div className="analysis-section">
        <strong>Приоритетные действия</strong>
        {result.priority_actions.length === 0 ? (
          <p className="analysis-empty">Действия не указаны.</p>
        ) : (
          <div className="analytics-list">
            {result.priority_actions.map((action) => (
              <div className="analytics-list-row criteria" key={`${action.title}-${action.expected_effect}-${action.priority}`}>
                <div>
                  <strong>{action.title || "Действие"}</strong>
                  <small>{action.expected_effect || "Эффект не указан"}</small>
                </div>
                {action.priority && <span>{enumLabel(action.priority, priorityLabels) ?? action.priority}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <AggregateStatisticsPanel statistics={result.aggregate_statistics} />
    </div>
  );
}

function AggregateSourceCoverage({
  analysis,
  source,
  coverageNote
}: {
  analysis: AggregateAnalysisResponse;
  source?: AggregateAnalysisResult["source_summary"];
  coverageNote?: string;
}) {
  const includedCalls = source?.included_in_statistics ?? analysis.source_calls_count;

  return (
    <section className="analysis-section aggregate-source-coverage">
      <strong>Покрытие источников</strong>
      <div className="aggregate-coverage-grid">
        <div>
          <span>Учтено в статистике</span>
          <strong>{callCountLabel(includedCalls)}</strong>
        </div>
        <div>
          <span>Примеры для AI</span>
          <strong>
            {source?.representative_calls === undefined ? "—" : callCountLabel(source.representative_calls)}
          </strong>
        </div>
        {source?.analyzed_calls !== undefined && source.analyzed_calls !== includedCalls ? (
          <div>
            <span>Готовых анализов в наборе</span>
            <strong>{callCountLabel(source.analyzed_calls)}</strong>
          </div>
        ) : null}
      </div>
      {source?.all_analyzed_calls_used === true && (
        <p className="aggregate-coverage-confirmation">
          Backend-статистика построена по всем готовым анализам за период.
        </p>
      )}
      {coverageNote && <p className="aggregate-secondary-text">{coverageNote}</p>}
      {source?.source_set_hash && (
        <small className="aggregate-source-hash">
          Состав набора: <code title={source.source_set_hash}>{shortIdentifier(source.source_set_hash)}</code>
        </small>
      )}
    </section>
  );
}

function AggregateDetailedReportView({ report }: { report?: AggregateAnalysisResult["detailed_report"] }) {
  const sections = report
    ? [
        ["Методика", report.methodology],
        ["Обзор качества", report.quality_overview],
        ["Анализ проблем", report.issue_analysis],
        ["Потери клиентов", report.customer_loss_analysis],
        ["План обучения", report.training_plan],
        ["Ограничения данных", report.data_limitations]
      ].filter((item): item is [string, string] => typeof item[1] === "string" && item[1].trim().length > 0)
    : [];

  if (sections.length === 0) return null;

  return (
    <section className="analysis-section aggregate-detailed-report">
      <strong>Подробный отчет</strong>
      <div className="aggregate-detailed-report-grid">
        {sections.map(([title, text]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AggregateIssueDetailList({
  title,
  items,
  emptyLabel
}: {
  title: string;
  items: NonNullable<AggregateAnalysisResult["systemic_issues"]>;
  emptyLabel: string;
}) {
  return (
    <section className="analysis-section">
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p className="analysis-empty">{emptyLabel}</p>
      ) : (
        <div className="analytics-list">
          {items.map((issue) => {
            const evidence = [...(issue.evidence_call_uuids ?? []), ...(issue.sample_call_uuids ?? [])];
            const count = issue.affected_calls_count ?? issue.count;

            return (
              <div className="analytics-list-row criteria aggregate-detail-row" key={`${issue.code}-${issue.title}-${evidence[0]}-${count}`}>
                <div>
                  <strong>{issue.title || issue.code || "Сигнал"}</strong>
                  {(issue.description || issue.reason) && <small>{issue.description || issue.reason}</small>}
                  {(count !== undefined || issue.affected_share !== undefined) && (
                    <small>
                      {count !== undefined ? `Затронуто: ${callCountLabel(count)}` : ""}
                      {count !== undefined && issue.affected_share !== undefined ? " · " : ""}
                      {issue.affected_share !== undefined ? formatShare(issue.affected_share) : ""}
                    </small>
                  )}
                  {issue.business_impact && <small>Влияние: {issue.business_impact}</small>}
                  {issue.recommendation && <small>Рекомендация: {issue.recommendation}</small>}
                  {evidence.length > 0 ? <UuidSamples values={evidence} /> : null}
                </div>
                {issue.severity && <span>{enumLabel(issue.severity, severityLabels) ?? issue.severity}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AggregateMetricDetailList({
  title,
  items,
  emptyLabel
}: {
  title: string;
  items: NonNullable<AggregateAnalysisResult["weak_criteria"]>;
  emptyLabel: string;
}) {
  return (
    <section className="analysis-section">
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p className="analysis-empty">{emptyLabel}</p>
      ) : (
        <div className="analytics-list">
          {items.map((item) => (
            <div className="analytics-list-row criteria aggregate-detail-row" key={`${item.code}-${item.title}-${item.evidence_call_uuids?.[0]}`}>
              <div>
                <strong>{item.title || item.code || "Метрика"}</strong>
                {item.explanation && <small>{item.explanation}</small>}
                {(item.affected_calls_count !== undefined || item.affected_share !== undefined) && (
                  <small>
                    {item.affected_calls_count !== undefined
                      ? `Затронуто: ${callCountLabel(item.affected_calls_count)}`
                      : ""}
                    {item.affected_calls_count !== undefined && item.affected_share !== undefined ? " · " : ""}
                    {item.affected_share !== undefined ? formatShare(item.affected_share) : ""}
                  </small>
                )}
                {item.recommendation && <small>Рекомендация: {item.recommendation}</small>}
                {item.evidence_call_uuids?.length ? <UuidSamples values={item.evidence_call_uuids} /> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AggregateStatisticsPanel({ statistics }: { statistics?: AggregateAnalysisResult["aggregate_statistics"] }) {
  const hasStatistics = Boolean(
    statistics &&
      [
        statistics.score_summary,
        statistics.issue_coverage?.length,
        statistics.weak_criteria?.length,
        statistics.business_outcomes?.length,
        statistics.lost_reasons?.length,
        statistics.customer_objections?.length,
        statistics.risks?.length,
        statistics.topics?.length,
        statistics.next_step_summary,
        statistics.attention_calls?.length,
        statistics.strong_calls?.length
      ].some(Boolean)
  );

  if (!hasStatistics || !statistics) return null;

  return (
    <section className="analysis-section aggregate-statistics">
      <details>
        <summary>Проверяемая статистика по звонкам</summary>
        <div className="aggregate-statistics-content">
          <AggregateScoreSummaryView summary={statistics.score_summary} />
          <AggregateFrequencyList title="Покрытие проблем" items={statistics.issue_coverage ?? []} />
          <AggregateCriterionStatistics items={statistics.weak_criteria ?? []} />
          <AggregateFrequencyList title="Бизнес-результаты" items={statistics.business_outcomes ?? []} />
          <AggregateFrequencyList title="Причины потерь" items={statistics.lost_reasons ?? []} />
          <AggregateFrequencyList title="Возражения клиентов" items={statistics.customer_objections ?? []} />
          <AggregateFrequencyList title="Риски" items={statistics.risks ?? []} />
          <AggregateFrequencyList title="Темы разговоров" items={statistics.topics ?? []} />
          <AggregateNextStepStatistics summary={statistics.next_step_summary} />
          <AggregateCallEvidenceList title="Звонки, требующие внимания" items={statistics.attention_calls ?? []} />
          <AggregateCallEvidenceList title="Сильные звонки" items={statistics.strong_calls ?? []} />
        </div>
      </details>
    </section>
  );
}

function AggregateScoreSummaryView({ summary }: { summary?: NonNullable<AggregateAnalysisResult["aggregate_statistics"]>["score_summary"] }) {
  if (!summary) return null;

  return (
    <div className="aggregate-stat-block">
      <h3>Оценки качества</h3>
      <div className="aggregate-stat-metrics">
        <StatisticMetric label="С оценкой" value={summary.calls_with_score} count />
        <StatisticMetric label="Средняя" value={summary.average} />
        <StatisticMetric label="Минимум" value={summary.min} />
        <StatisticMetric label="Максимум" value={summary.max} />
        <StatisticMetric label="Низкие" value={summary.low_count} count />
        <StatisticMetric label="Средние" value={summary.medium_count} count />
        <StatisticMetric label="Высокие" value={summary.high_count} count />
      </div>
    </div>
  );
}

function AggregateFrequencyList({
  title,
  items
}: {
  title: string;
  items: NonNullable<AggregateAnalysisResult["aggregate_statistics"]>["issue_coverage"];
}) {
  if (!items?.length) return null;

  return (
    <div className="aggregate-stat-block">
      <h3>{title}</h3>
      <div className="aggregate-stat-list">
        {items.map((item) => (
          <div className="aggregate-stat-row" key={`${item.code}-${item.title}-${item.sample_call_uuids?.[0]}`}>
            <div>
              <strong>{item.title || item.code || "Показатель"}</strong>
              {item.sample_call_uuids?.length ? <UuidSamples values={item.sample_call_uuids} /> : null}
            </div>
            <span>
              {item.count !== undefined ? callCountLabel(item.count) : "—"}
              {item.share !== undefined ? ` · ${formatShare(item.share)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AggregateCriterionStatistics({
  items
}: {
  items: NonNullable<AggregateAnalysisResult["aggregate_statistics"]>["weak_criteria"];
}) {
  if (!items?.length) return null;

  return (
    <div className="aggregate-stat-block">
      <h3>Слабые критерии: фактические показатели</h3>
      <div className="aggregate-stat-list">
        {items.map((item) => (
          <div className="aggregate-stat-row aggregate-criterion-row" key={`${item.code}-${item.title}-${item.sample_call_uuids?.[0]}`}>
            <div>
              <strong>{item.title || item.code || "Критерий"}</strong>
              <small>
                {item.weak_calls !== undefined ? `Слабых: ${callCountLabel(item.weak_calls)}` : ""}
                {item.weak_calls !== undefined && item.weak_share !== undefined ? " · " : ""}
                {item.weak_share !== undefined ? formatShare(item.weak_share) : ""}
              </small>
              <small>
                Пропущено: {item.missed_calls ?? "—"} · Частично: {item.partially_met_calls ?? "—"} · Неясно: {item.unclear_calls ?? "—"}
                {item.average_points_share !== undefined ? ` · Среднее: ${formatShare(item.average_points_share)}` : ""}
              </small>
              {item.sample_call_uuids?.length ? <UuidSamples values={item.sample_call_uuids} /> : null}
            </div>
            <span>{item.applicable_calls !== undefined ? callCountLabel(item.applicable_calls) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AggregateNextStepStatistics({
  summary
}: {
  summary?: NonNullable<AggregateAnalysisResult["aggregate_statistics"]>["next_step_summary"];
}) {
  if (!summary) return null;

  return (
    <div className="aggregate-stat-block">
      <h3>Следующие шаги</h3>
      <div className="aggregate-stat-metrics">
        <StatisticMetric label="Есть следующий шаг" value={summary.calls_with_next_step} count />
        <StatisticMetric label="Есть конкретный шаг" value={summary.calls_with_specific_next_step} count />
        <StatisticMetric label="Нет следующего шага" value={summary.calls_missing_next_step} count />
        <StatisticMetric label="Нет конкретики" value={summary.calls_missing_specific_step} count />
        <StatisticMetric label="Без следующего шага" value={summary.missing_next_step_share} share />
        <StatisticMetric label="Без конкретики" value={summary.missing_specific_step_share} share />
      </div>
    </div>
  );
}

function AggregateCallEvidenceList({
  title,
  items
}: {
  title: string;
  items: NonNullable<AggregateAnalysisResult["aggregate_statistics"]>["attention_calls"];
}) {
  if (!items?.length) return null;

  return (
    <div className="aggregate-stat-block">
      <h3>{title}</h3>
      <div className="aggregate-stat-list">
        {items.map((item) => (
          <div className="aggregate-stat-row aggregate-evidence-row" key={`${item.call_uuid}-${item.title}`}>
            <div>
              <strong>{item.title || "Звонок"}</strong>
              {item.summary && <small>{item.summary}</small>}
              {item.call_uuid ? <UuidSamples values={[item.call_uuid]} /> : null}
              {item.issue_codes?.length ? <small>Сигналы: {item.issue_codes.join(", ")}</small> : null}
            </div>
            <span>{item.score === undefined || item.score === null ? "—" : item.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatisticMetric({
  label,
  value,
  count = false,
  share = false
}: {
  label: string;
  value?: number | null;
  count?: boolean;
  share?: boolean;
}) {
  const rendered = share
    ? formatShare(value)
    : value === undefined || value === null
      ? "—"
      : count
        ? callCountLabel(value)
        : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);

  return (
    <div>
      <strong>{rendered}</strong>
      <span>{label}</span>
    </div>
  );
}

function UuidSamples({ values }: { values: string[] }) {
  const uniqueValues = Array.from(new Set(values)).slice(0, 5);
  if (uniqueValues.length === 0) return null;

  return (
    <span className="aggregate-uuid-samples">
      {uniqueValues.map((value, index) => (
        <a
          className="aggregate-call-link"
          href={`/app/calls?call=${encodeURIComponent(value)}`}
          key={value}
          title="Перейти к звонку"
        >
          Звонок {index + 1}
        </a>
      ))}
    </span>
  );
}

function AggregateReportsPanel({
  analysis,
  reports,
  loading,
  selectedFormat,
  busyReportId,
  onFormatChange,
  onCreate,
  onDownload,
  onDelete
}: {
  analysis: AggregateAnalysisResponse;
  reports: AggregateReportResponse[];
  loading: boolean;
  selectedFormat: ReportFormat;
  busyReportId: string;
  onFormatChange: (format: ReportFormat) => void;
  onCreate: () => void;
  onDownload: (report: AggregateReportResponse) => void;
  onDelete: (report: AggregateReportResponse) => void;
}) {
  return (
    <section className="glass-panel aggregate-report-panel deep-analysis-export-panel">
      <div className="card-title">
        <div>
          <h3>Экспорт глубокого анализа</h3>
          <p>Подготовьте PDF, DOCX, Markdown или Excel для выбранного анализа.</p>
        </div>
      </div>
      <div className="report-format-actions">
        {reportFormats.map((item) => (
          <button
            className={`report-action-row deep-report-format-button ${selectedFormat === item.format ? "active" : ""}`}
            type="button"
            key={item.format}
            onClick={() => onFormatChange(item.format)}
            aria-pressed={selectedFormat === item.format}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={analysis.status !== "done" || busyReportId === "create"}
        onClick={onCreate}
      >
        <Plus size={17} />
        Создать {reportFormatLabel(selectedFormat)}
      </button>
      <div className="report-list">
        <div className="report-list-title">
          <strong>История экспортов</strong>
          {loading && <span>Загружаю...</span>}
        </div>
        {!loading && reports.length === 0 && (
          <div className="empty-state compact">Отчетов для этого глубокого анализа еще нет.</div>
        )}
        {reports.map((report) => (
          <div className="report-row" key={report.id}>
            <FileBarChart2 size={18} />
            <div className="report-row-content">
              <strong className="report-file-name" title={report.file_name}>{reportFileLabel(report.file_name)}</strong>
              <small className="report-meta">
                {reportFormatLabel(report.format as ReportFormat)} · {formatBytes(report.size_bytes)} · создан{" "}
                {formatDate(report.created_at)}
              </small>
              {report.error_message && <small className="report-error">{friendlyAggregateReportError(report.error_message)}</small>}
            </div>
            <span className={`status-chip ${report.status === "ready" ? "ok" : report.status === "failed" ? "bad" : "warn"}`}>
              {aggregateReportStatusLabel(report.status)}
            </span>
            <div className="report-actions">
              <button
                className="icon-button"
                aria-label="Скачать отчет глубокого анализа"
                onClick={() => onDownload(report)}
                disabled={report.status !== "ready" || busyReportId === report.id}
              >
                <Download size={17} />
              </button>
              <button
                className="icon-button danger-icon"
                aria-label="Удалить отчет глубокого анализа"
                onClick={() => onDelete(report)}
                disabled={busyReportId === report.id}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AggregateFindingList({
  items
}: {
  items: AggregateAnalysisResult["key_findings"];
}) {
  return (
    <div className="analysis-section">
      <strong>Ключевые выводы</strong>
      {items.length === 0 ? (
        <p className="analysis-empty">Выводы не указаны.</p>
      ) : (
        <div className="analytics-list">
          {items.map((finding) => (
            <div className="analytics-list-row criteria aggregate-detail-row" key={`${finding.title}-${finding.description}-${finding.evidence_call_uuids?.[0]}`}>
              <div>
                <strong>{finding.title || "Ключевой вывод"}</strong>
                {finding.description && <small>{finding.description}</small>}
                {(finding.affected_calls_count !== undefined || finding.affected_share !== undefined) && (
                  <small>
                    {finding.affected_calls_count !== undefined
                      ? `Затронуто: ${callCountLabel(finding.affected_calls_count)}`
                      : ""}
                    {finding.affected_calls_count !== undefined && finding.affected_share !== undefined ? " · " : ""}
                    {finding.affected_share !== undefined ? formatShare(finding.affected_share) : ""}
                  </small>
                )}
                {finding.evidence_call_uuids?.length ? <UuidSamples values={finding.evidence_call_uuids} /> : null}
              </div>
              {finding.severity && <span>{enumLabel(finding.severity, severityLabels) ?? finding.severity}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AggregateStringList({ items, emptyLabel }: { items: string[]; emptyLabel: string; }) {
  if (items.length === 0) return <p className="analysis-empty">{emptyLabel}</p>;

  return (
    <ul className="analysis-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function ReportMetric({ value, label, note }: { value: string; label: string; note: string; }) {
  return (
    <div className="report-metric glass-panel">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

function defaultDeepForm(): DeepAnalysisFormState {
  return {
    scope: "personal",
    company_uuid: "",
    department_uuid: "",
    folder_uuid: "",
    period_from: dateInputOffset(-30),
    period_to: dateInputOffset(0),
    force: false
  };
}

type DeepPayloadResult =
  | { ok: true; value: CreateDeepAnalysisRequest }
  | { ok: false; error: string };

function buildDeepAnalysisPayload(
  form: DeepAnalysisFormState
): DeepPayloadResult {
  if (!form.period_from || !form.period_to) {
    return { ok: false, error: "Выберите начало и конец периода." };
  }

  if (new Date(form.period_from).getTime() > new Date(form.period_to).getTime()) {
    return { ok: false, error: "Начало периода не должно быть позже конца." };
  }

  if (form.scope === "company" && !form.company_uuid) {
    return { ok: false, error: "Для анализа компании выберите компанию." };
  }

  if (form.scope === "department" && (!form.company_uuid || !form.department_uuid)) {
    return { ok: false, error: "Для анализа отдела выберите компанию и отдел." };
  }

  if (form.scope === "folder" && !form.folder_uuid) {
    return { ok: false, error: "Для анализа папки выберите папку." };
  }

  const base = {
    scope: form.scope,
    period_from: form.period_from,
    period_to: form.period_to,
    force: form.force
  };

  if (form.scope === "company") {
    return { ok: true, value: { ...base, company_uuid: form.company_uuid } };
  }

  if (form.scope === "department") {
    return {
      ok: true,
      value: {
        ...base,
        company_uuid: form.company_uuid,
        department_uuid: form.department_uuid
      }
    };
  }

  if (form.scope === "folder") {
    return { ok: true, value: { ...base, folder_uuid: form.folder_uuid } };
  }

  return { ok: true, value: base };
}

function parseDeepAnalysisStatusEvent(event: Event): AggregateAnalysisStatusEvent | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;

  try {
    const payload = JSON.parse(event.data) as Partial<AggregateAnalysisStatusEvent>;
    if (
      typeof payload.analysis_id !== "string" ||
      typeof payload.status !== "string" ||
      typeof payload.terminal !== "boolean" ||
      typeof payload.timestamp !== "string"
    ) {
      return null;
    }

    return {
      analysis_id: payload.analysis_id,
      status: payload.status,
      terminal: payload.terminal,
      timestamp: payload.timestamp
    };
  } catch {
    return null;
  }
}

function reportFileLabel(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bdeep analysis\b/gi, "глубокий анализ")
    .replace(/\bai report\b/gi, "AI-отчет")
    .replace(/\bsummary\b/gi, "сводка")
    .trim() || "готовый экспорт";
}

function reportCallSearchText(call: CallResponse) {
  return [
    call.title,
    call.original_filename,
    call.id
  ].join(" ").toLowerCase();
}

function deepAnalysisContext(
  analysis: AggregateAnalysisResponse,
  companies: CompanyResponse[],
  departments: DepartmentResponse[],
  folders: CallFolderResponse[]
) {
  const company = analysis.company_uuid
    ? companies.find((item) => item.id === analysis.company_uuid)
    : undefined;
  const department = analysis.department_uuid
    ? departments.find((item) => item.id === analysis.department_uuid)
    : undefined;
  const folder = analysis.folder_uuid
    ? folders.find((item) => item.id === analysis.folder_uuid)
    : undefined;
  const folderCompany = folder?.company_uuid
    ? companies.find((item) => item.id === folder.company_uuid)
    : undefined;
  const folderDepartment = folder?.department_uuid
    ? departments.find((item) => item.id === folder.department_uuid)
    : undefined;

  if (analysis.scope === "company") {
    return {
      title: company ? `Компания «${company.name}»` : "Компания",
      details: company ? "" : "Компания не найдена в текущем списке"
    };
  }

  if (analysis.scope === "department") {
    return {
      title: department ? `Отдел «${department.name}»` : "Отдел",
      details: company ? `Компания: ${company.name}` : "Компания не найдена в текущем списке"
    };
  }

  if (analysis.scope === "folder") {
    const ownerParts = [
      folderDepartment ? `отдел ${folderDepartment.name}` : "",
      folderCompany ? `компания ${folderCompany.name}` : ""
    ].filter(Boolean);

    return {
      title: folder ? `Папка «${folder.name}»` : "Папка",
      details: ownerParts.length > 0 ? ownerParts.join(" · ") : folder ? deepScopeLabel(folder.scope) : "Папка не найдена в текущем списке"
    };
  }

  return {
    title: "Личный анализ",
    details: ""
  };
}

function friendlyDeepActionError(message: string) {
  return message.trim() || "Не удалось выполнить действие с глубоким анализом.";
}

function friendlyDeepAnalysisError(message?: string | null) {
  return message?.trim() || "Не удалось сформировать анализ. Проверьте период и попробуйте снова.";
}

function friendlyAggregateReportError(message?: string | null) {
  return message?.trim() || "Не удалось подготовить экспорт. Попробуйте создать его заново.";
}

function aggregateStatusLabel(status: string) {
  if (status === "done") return "Готов";
  if (status === "failed") return "Ошибка";
  if (status === "processing") return "Формируется";
  if (status === "pending") return "В очереди";
  return `Статус: ${status}`;
}

function aggregateReportStatusLabel(status: string) {
  if (status === "ready") return "Готов";
  if (status === "failed") return "Ошибка";
  if (status === "pending") return "Формируется";
  return `Статус: ${status}`;
}

function deepScopeLabel(scope: string) {
  if (scope === "personal") return "Лично";
  if (scope === "company") return "Компания";
  if (scope === "department") return "Отдел";
  if (scope === "folder") return "Папка";
  return scope;
}

function dateInputOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
  const responses = await Promise.allSettled(requests);
  const folders = new Map<string, CallFolderResponse>();
  const errors: string[] = [];

  responses.forEach((response) => {
    if (response.status === "fulfilled") {
      response.value.items.forEach((folder) => folders.set(folder.id, folder));
      return;
    }

    errors.push(
      response.reason instanceof Error ? response.reason.message : "Не удалось загрузить часть папок звонков."
    );
  });

  return {
    items: Array.from(folders.values()),
    error: errors[0]
  };
}

function upsertDeepAnalysis(
  current: AggregateAnalysisResponse[],
  next: AggregateAnalysisResponse
) {
  const existingIndex = current.findIndex((analysis) => analysis.id === next.id);

  if (existingIndex === -1) {
    return [next, ...current];
  }

  return current.map((analysis) => (analysis.id === next.id ? next : analysis));
}
