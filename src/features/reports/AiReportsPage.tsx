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
import { api } from "../../api";
import type {
  AggregateAnalysisResponse,
  AggregateAnalysisResult,
  AggregateAnalysisStatus,
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
import { reportFormats } from "./ReportExportPanel";

type ReportsTab = "call" | "deep";

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
  const [activeTab, setActiveTab] = useState<ReportsTab>("call");
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
  const selectedFolder = deepFolders.find((folder) => folder.id === deepForm.folder_uuid);
  const processingReports = calls.filter((call) => call.status === "processing").length;
  const latestReport = reports[0];
  const doneDeepCount = deepAnalyses.filter((analysis) => analysis.status === "done").length;
  const activeDeepCount = deepAnalyses.filter((analysis) =>
    analysis.status === "pending" || analysis.status === "processing"
  ).length;
  const formDepartmentOptions = departments.filter((department) => department.company_uuid === deepForm.company_uuid);
  const companiesFolderKey = companies.map((company) => company.id).join("|");
  const departmentsFolderKey = departments.map((department) => `${department.company_uuid}:${department.id}`).join("|");

  useEffect(() => {
    if (selectedCallId && readyAnalyses.some((call) => call.id === selectedCallId)) return;
    setSelectedCallId(readyAnalyses[0]?.id ?? "");
  }, [readyAnalyses, selectedCallId]);

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
    if (activeTab !== "deep") return;
    let cancelled = false;

    async function loadFolders() {
      setLoadingDeepFolders(true);
      const response = await loadCallFoldersForContext(companies, departments).catch(() => []);
      if (!cancelled) {
        setDeepFolders(response);
        setLoadingDeepFolders(false);
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
    const payload = buildDeepAnalysisPayload(deepForm, selectedFolder);
    if (!payload.ok) {
      setDeepActionError(payload.error);
      return;
    }

    setDeepActionError("");
    setDeepBusy(true);
    try {
      const created = await api.createDeepAnalysis(payload.value);
      setSelectedDeepAnalysisId(created.id);
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
        <button className={activeTab === "call" ? "active" : ""} type="button" onClick={() => setActiveTab("call")}>
          Отчеты по звонкам
        </button>
        <button className={activeTab === "deep" ? "active" : ""} type="button" onClick={() => setActiveTab("deep")}>
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
            <ReportMetric value={activeDeepCount.toString()} label="Формируется" note="pending/processing" />
            <ReportMetric value={deepFolders.length.toString()} label="Папок доступно" note={loadingDeepFolders ? "загружаю" : "для scope folder"} />
          </div>
          <DeepAnalysisSection
            companies={companies}
            departments={departments}
            folders={deepFolders}
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
            onSelectAnalysis={setSelectedDeepAnalysisId}
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
  return (
    <div className="deep-analysis-grid">
      <section className="glass-panel entity-detail-panel deep-analysis-form-panel">
        <div className="panel-heading large">
          <div>
            <h2>Создать глубокий анализ</h2>
            <p>Backend использует сохраненные результаты анализов звонков, без передачи транскрипций на frontend.</p>
          </div>
        </div>
        {actionError && <div className="form-error">{actionError}</div>}
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
                    {folder.name} · {deepScopeLabel(folder.scope)}
                  </option>
                ))}
              </SelectControl>
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
              <small>По умолчанию backend вернет существующий non-failed анализ за тот же период.</small>
            </span>
          </label>
          <button className="primary-button" type="button" disabled={busy} onClick={onCreateAnalysis}>
            <Plus size={17} />
            {busy ? "Создаю..." : "Создать глубокий анализ"}
          </button>
        </div>
      </section>

      <section className="glass-panel entity-list-panel">
        <div className="panel-heading large">
          <div>
            <h2>История глубокого анализа</h2>
            <p>Pending/processing можно обновлять вручную.</p>
          </div>
          <button className="ghost-button small" type="button" onClick={onRefreshAnalyses}>
            <RefreshCcw size={16} />
            Обновить
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
          {loadingAnalyses ? (
            <div className="report-placeholder-row">
              <FileBarChart2 size={22} />
              <div>
                <strong>Загружаю глубокие анализы</strong>
                <small>Запрос к /analytics/deep-analyses</small>
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
            analyses.map((analysis) => (
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
                  <strong>{deepScopeLabel(analysis.scope)} · {analysis.source_calls_count} звонков</strong>
                  <small>
                    {dateOnly(analysis.period_from)} - {dateOnly(analysis.period_to)} · создан{" "}
                    {formatDate(analysis.created_at)}
                  </small>
                  {analysis.provider && (
                    <small>{analysis.provider}{analysis.model ? ` · ${analysis.model}` : ""}</small>
                  )}
                  {analysis.error_message && <small className="report-error">{analysis.error_message}</small>}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="glass-panel entity-detail-panel deep-analysis-result-panel">
        {selectedAnalysis ? (
          <>
            <div className="panel-heading large">
              <div>
                <h2>Результат глубокого анализа</h2>
                <p>
                  {deepScopeLabel(selectedAnalysis.scope)} · {dateOnly(selectedAnalysis.period_from)} -{" "}
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
              <div className="form-error">{selectedAnalysis.error_message || "Глубокий анализ завершился ошибкой."}</div>
            ) : (
              <div className="empty-state compact">Глубокий анализ формируется. Обновите историю позже.</div>
            )}
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
          </>
        ) : (
          <div className="empty-panel compact">
            <FileBarChart2 size={28} />
            <p>Выберите глубокий анализ из истории.</p>
          </div>
        )}
      </section>
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
          <p>{analysis.result_text || "Backend не вернул структурированный результат."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-structured aggregate-result">
      <div className="analysis-section">
        <strong>Резюме</strong>
        <p>{result.summary || "Резюме не указано."}</p>
        <small>Уверенность: {enumLabel(result.confidence, confidenceLabels) ?? "Не указана"}</small>
      </div>
      <AggregateFindingList items={result.key_findings} />
      <div className="analysis-section">
        <strong>Повторяющиеся проблемы</strong>
        {result.recurring_issues.length === 0 ? (
          <p className="analysis-empty">Проблемы не указаны.</p>
        ) : (
          <div className="analytics-list">
            {result.recurring_issues.map((issue) => (
              <div className="analytics-list-row criteria" key={`${issue.code}-${issue.title}`}>
                <div>
                  <strong>{issue.title || issue.code}</strong>
                  <small>{issue.recommendation || "Рекомендация не указана"}</small>
                </div>
                <span>{issue.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
              <div className="analytics-list-row criteria" key={action.title}>
                <div>
                  <strong>{action.title}</strong>
                  <small>{action.expected_effect || "Эффект не указан"}</small>
                </div>
                <span>{enumLabel(action.priority, priorityLabels) ?? action.priority}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <section className="aggregate-report-panel">
      <div className="card-title">
        <div>
          <h3>Отчеты глубокого анализа</h3>
          <p>PDF, DOCX, Markdown или Excel для выбранного deep analysis.</p>
        </div>
      </div>
      <div className="report-format-actions">
        {reportFormats.map((item) => (
          <button
            className={`report-action-row ${selectedFormat === item.format ? "active" : ""}`}
            type="button"
            key={item.format}
            onClick={() => onFormatChange(item.format)}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
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
              {report.error_message && <small className="report-error">{report.error_message}</small>}
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
            <div className="analytics-list-row criteria" key={finding.title}>
              <div>
                <strong>{finding.title}</strong>
                <small>{finding.description}</small>
                {finding.evidence_call_uuids.length > 0 && (
                  <small>Звонки: {finding.evidence_call_uuids.slice(0, 3).join(", ")}</small>
                )}
              </div>
              <span>{enumLabel(finding.severity, severityLabels) ?? finding.severity}</span>
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
  form: DeepAnalysisFormState,
  folder?: CallFolderResponse
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

  return {
    ok: true,
    value: {
      scope: form.scope,
      company_uuid:
        form.scope === "company" || form.scope === "department"
          ? form.company_uuid
          : folder?.company_uuid ?? null,
      department_uuid: form.scope === "department" ? form.department_uuid : folder?.department_uuid ?? null,
      folder_uuid: form.scope === "folder" ? form.folder_uuid : null,
      period_from: form.period_from,
      period_to: form.period_to,
      force: form.force
    }
  };
}

function aggregateResult(value: AggregateAnalysisResponse["result_json"]): AggregateAnalysisResult | null {
  if (!isRecord(value)) return null;

  return {
    summary: stringValue(value.summary) ?? "",
    key_findings: recordList(value.key_findings).map((item) => ({
      title: stringValue(item.title) ?? "Вывод",
      description: stringValue(item.description) ?? "",
      severity: stringValue(item.severity) ?? "unclear",
      evidence_call_uuids: stringList(item.evidence_call_uuids)
    })),
    recurring_issues: recordList(value.recurring_issues).map((item) => ({
      code: stringValue(item.code) ?? "",
      title: stringValue(item.title) ?? stringValue(item.code) ?? "Проблема",
      count: numberValue(item.count),
      recommendation: stringValue(item.recommendation) ?? ""
    })),
    strengths: stringList(value.strengths),
    risks: stringList(value.risks),
    priority_actions: recordList(value.priority_actions).map((item) => ({
      title: stringValue(item.title) ?? "Действие",
      priority: stringValue(item.priority) ?? "medium",
      expected_effect: stringValue(item.expected_effect) ?? ""
    })),
    manager_recommendations: stringList(value.manager_recommendations),
    confidence: stringValue(value.confidence) ?? "unclear"
  };
}

function reportFileLabel(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "готовый экспорт";
}

function reportCallSearchText(call: CallResponse) {
  return [
    call.title,
    call.original_filename,
    call.id
  ].join(" ").toLowerCase();
}

function aggregateStatusLabel(status: string) {
  if (status === "done") return "Готов";
  if (status === "failed") return "Ошибка";
  if (status === "processing") return "Формируется";
  return "В очереди";
}

function aggregateReportStatusLabel(status: string) {
  if (status === "ready") return "Готов";
  if (status === "failed") return "Ошибка";
  return "Формируется";
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
  const responses = await Promise.all(
    requests.map((request) => request.catch(() => ({ items: [] as CallFolderResponse[] })))
  );
  const folders = new Map<string, CallFolderResponse>();

  responses.forEach((response) => {
    response.items.forEach((folder) => folders.set(folder.id, folder));
  });

  return Array.from(folders.values());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordList(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown) {
  if (typeof value === "string") {
    const item = stringValue(value);
    return item ? [item] : [];
  }

  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = stringValue(item);
    return text ? [text] : [];
  });
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
