import {
  BarChart3,
  Clock3,
  CloudUpload,
  Headphones,
  Phone,
  Search,
  Sparkles,
  Star,
  TriangleAlert
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisResponse,
  AnalyticsOverviewResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  TranscriptionResponse,
  VisibilityScope
} from "../../types";

import { analysisDetails, isAnalysisDone } from "../../shared/lib/analysis";
import { contextLabel, formatDate, formatDuration } from "../../shared/lib/formatters";
import { AnalysisPreview } from "../../shared/ui/analysis";
import { CallAudioPlayer } from "../../shared/ui/audio";
import { StatusChip, StatusTimeline, TranscriptPreview } from "../../shared/ui/call";
import { CallListSkeleton } from "../../shared/ui/loading";
import { SelectControl } from "../../shared/ui/primitives";

export function OverviewPage({
  calls,
  companies,
  departments,
  selectedCall,
  selectedCallId,
  selectedCallTimeline,
  transcription,
  analysis,
  analyses,
  loading,
  loadingDetails,
  onSelectCall,
  onNavigate
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
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onNavigate: (page: AppPage) => void;
}) {
  const [activeDetailTab, setActiveDetailTab] = useState<"transcript" | "analysis" | "details">("transcript");
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [latestReportNote, setLatestReportNote] = useState("нет готового экспорта");
  const avgDuration = analyticsOverview?.average_duration_seconds === null || analyticsOverview === null
    ? "Нет данных"
    : formatDuration(Math.round(analyticsOverview.average_duration_seconds));
  const score = qualityScore(analysis);
  const details = analysisDetails(analysis);
  const analyticsScore = analyticsOverview?.average_quality_score ?? null;
  const qualityScale = analyticsOverview?.quality_score_scale ?? 5;
  const riskValue = analyticsOverview?.risks_count ?? null;
  const topics = details.topics.slice(0, 4);
  const chartSeries = buildOverviewChartSeries(analyticsOverview);
  const qualityDonutPercent = analyticsScore === null ? 0 : (analyticsScore / qualityScale) * 100;
  const qualityDonutLabel = analyticsScore === null
    ? "нет данных"
    : `${analyticsScore.toFixed(1).replace(".", ",")} / ${qualityScale}`;
  const filteredCalls = calls.filter((call) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesScope = scopeFilter === "all" || call.visibility_scope === scopeFilter;
    const matchesSearch = !query || callSearchText(call).includes(query);

    return matchesStatus && matchesScope && matchesSearch;
  });

  useEffect(() => {
    setActiveDetailTab("transcript");
  }, [selectedCall?.id]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.getAnalyticsOverview().catch(() => null),
      api.listGlobalReports({ limit: 1, sort: "created_at", order: "desc" }).catch(() => null)
    ]).then(([overview, reports]) => {
      if (cancelled) return;
      setAnalyticsOverview(overview);
      const latestReport = reports?.reports[0];
      setLatestReportNote(latestReport ? `${publicReportName(latestReport.file_name)} · ${formatDate(latestReport.created_at)}` : "нет готового экспорта");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="dashboard-page app-page">
      <div className="dashboard-kpi-grid">
        <MetricCard icon={<BarChart3 size={20} />} title="Всего звонков" value={analyticsOverview ? analyticsOverview.calls_total.toString() : "Нет данных"} points={chartSeries.totalCalls} />
        <MetricCard icon={<Phone size={20} />} title="С анализом" value={analyticsOverview ? analyticsOverview.calls_analyzed.toString() : "Нет данных"} tone="success" points={chartSeries.analyzedCalls} />
        <MetricCard icon={<Clock3 size={20} />} title="Средняя длительность" value={avgDuration} points={chartSeries.duration} />
        <MetricCard icon={<TriangleAlert size={20} />} title="Риски" value={riskValue === null ? "Нет данных" : riskValue.toString()} tone="warning" points={chartSeries.risks} />
        <MetricCard
          icon={<Star size={20} />}
          title="Оценка качества"
          value={analyticsScore === null ? "Нет данных" : `${analyticsScore.toFixed(1).replace(".", ",")} / ${qualityScale}`}
          tone="success"
          points={chartSeries.quality}
          donutPercent={qualityDonutPercent}
          donutLabel={qualityDonutLabel}
        />
      </div>

      <div className="dashboard-workspace-grid">
        <aside className="dashboard-call-list glass-panel">
          <div className="panel-heading large">
            <div>
              <h2>Звонки</h2>
              <p>{calls.length} всего · последний экспорт: {latestReportNote}</p>
            </div>
            <button className="primary-button small" type="button" onClick={() => onNavigate("upload")}>
              <CloudUpload size={16} />
              Загрузить
            </button>
          </div>
          <div className="dashboard-filter-row">
            <SelectControl
              aria-label="Статус звонков"
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
              aria-label="Контекст звонков"
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as VisibilityScope | "all")}
            >
              <option value="all">Все звонки</option>
              <option value="personal">Личные</option>
              <option value="company">Компания</option>
              <option value="department">Отдел</option>
            </SelectControl>
          </div>
          <div className="dashboard-call-search">
            <Search size={17} />
            <input
              placeholder="Поиск по названию"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="dashboard-call-stack">
            {loading ? (
              <CallListSkeleton count={5} compact />
            ) : filteredCalls.length === 0 ? (
              <div className="empty-panel compact">
                <Headphones size={30} />
                <p>{calls.length === 0 ? "Звонков пока нет." : "Звонков по фильтрам не найдено."}</p>
              </div>
            ) : (
              filteredCalls.slice(0, 8).map((call) => (
                <button
                  className={`dashboard-call-row ${selectedCallId === call.id ? "selected" : ""}`}
                  type="button"
                  key={call.id}
                  onClick={() => onSelectCall(call.id)}
                >
                  <span className="dashboard-call-icon">
                    <Phone size={16} />
                  </span>
                  <span className="dashboard-call-main">
                    <StatusChip status={call.status} />
                    <strong>{call.title}</strong>
                    <small>{formatDate(call.created_at)} · {formatDuration(call.duration_seconds)} · {contextLabel(call, companies, departments)}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="dashboard-detail-panel glass-panel">
          {selectedCall ? (
            <>
              <div className="dashboard-detail-head">
                <div>
                  <h2>{selectedCall.title}</h2>
                  <p>
                    {formatDate(selectedCall.created_at)} · {formatDuration(selectedCall.duration_seconds)} ·{" "}
                    {contextLabel(selectedCall, companies, departments)}
                  </p>
                </div>
                <StatusChip status={selectedCall.status} />
              </div>
              <div className="dashboard-tabs" aria-label="Разделы звонка">
                <button
                  className={activeDetailTab === "transcript" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveDetailTab("transcript")}
                >
                  Расшифровка
                </button>
                <button
                  className={activeDetailTab === "analysis" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveDetailTab("analysis")}
                >
                  AI-анализ
                </button>
                <button
                  className={activeDetailTab === "details" ? "active" : ""}
                  type="button"
                  onClick={() => setActiveDetailTab("details")}
                >
                  Детали
                </button>
              </div>
              {activeDetailTab === "transcript" && (
                <div className="dashboard-transcript-card">
                  <TranscriptPreview transcription={transcription} expanded loading={loadingDetails} />
                </div>
              )}
              {activeDetailTab === "analysis" && (
                <div className="dashboard-transcript-card">
                  <AnalysisPreview analysis={analysis} expanded loading={loadingDetails} />
                </div>
              )}
              {activeDetailTab === "details" && (
                <div className="dashboard-transcript-card dashboard-details-card">
                  <DetailItem label="Файл" value={selectedCall.original_filename} />
                  <DetailItem label="Тип файла" value={selectedCall.mime_type} />
                  <DetailItem label="Размер" value={formatBytes(selectedCall.size_bytes)} />
                  <DetailItem label="Длительность" value={formatDuration(selectedCall.duration_seconds)} />
                  <DetailItem label="Контекст" value={contextLabel(selectedCall, companies, departments)} />
                </div>
              )}
              <CallAudioPlayer call={selectedCall} />
            </>
          ) : (
            <div className="empty-panel">
              <Headphones size={38} />
              <h2>Выберите звонок</h2>
              <p>После загрузки здесь появится расшифровка и аудио-плеер.</p>
            </div>
          )}
        </section>

        <aside className="dashboard-ai-column">
          <section className="dashboard-ai-card glass-panel">
            <div className="card-title">
              <h2>AI-анализ</h2>
              <Sparkles size={21} />
            </div>
            <div className="ai-score-row">
              <ProgressRing percent={score.percent} label={score.ringValue} />
              <div>
                <strong>{isAnalysisDone(analysis) ? "Качество разговора" : "Анализ ожидается"}</strong>
                <p>{details.summary}</p>
              </div>
            </div>
            <div className="ai-chip-list">
              <span>Интерес к продукту</span>
              <span>Вопросы по интеграции</span>
              <span>Обучение</span>
            </div>
            <div className="ai-topic-list">
              <strong>Ключевые темы</strong>
              {topics.length === 0 ? (
                <p>Темы появятся после готового анализа.</p>
              ) : (
                <ul>
                  {topics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="dashboard-status-card glass-panel">
            <h2>Статус обработки</h2>
            {selectedCall ? (
              <StatusTimeline current={selectedCall.status} statuses={selectedCallTimeline} />
            ) : (
              <p className="muted">Выберите звонок, чтобы увидеть статус обработки.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string; }) {
  return (
    <div className="dashboard-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1).replace(".", ",")} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

function MetricCard({
  icon,
  title,
  value,
  tone = "accent",
  points,
  donutPercent,
  donutLabel
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  tone?: "accent" | "success" | "warning";
  points: ChartPoint[];
  donutPercent?: number;
  donutLabel?: string;
}) {
  return (
    <article className={`dashboard-kpi-card glass-panel ${tone}`}>
      <div>
        <span className="metric-icon">{icon}</span>
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      {typeof donutPercent === "number" ? (
        <QualityDonut percent={donutPercent} label={donutLabel ?? value} />
      ) : (
        <MiniSparkline points={points} tone={tone} />
      )}
    </article>
  );
}

type ChartPoint = {
  label: string;
  value: number;
  display: string;
  detail?: string;
};

function MiniSparkline({ points, tone }: { points: ChartPoint[]; tone: "accent" | "success" | "warning"; }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const prepared = points.length > 0 ? points : [{ label: "Нет данных", value: 0, display: "0" }];
  const animationKey = prepared.map((point) => `${point.label}:${point.value}:${point.display}`).join("|");
  const drawProgress = useDrawProgress(animationKey, 1900);
  const max = Math.max(...prepared.map((point) => point.value), 1);
  const min = Math.min(...prepared.map((point) => point.value), 0);
  const range = Math.max(1, max - min);
  const step = prepared.length > 1 ? 138 / (prepared.length - 1) : 138;
  const coordinates = prepared.map((point, index) => {
    const x = 10 + index * step;
    const y = 44 - ((point.value - min) / range) * 34;
    return {
      ...point,
      x,
      y: Math.max(8, Math.min(46, y))
    };
  });
  const path = smoothPath(coordinates);

  return (
    <div className={`mini-chart ${tone}`}>
      <svg className="mini-sparkline" viewBox="0 0 160 52" role="img" aria-label="График значения">
        <path
          d={path}
          pathLength={100}
          style={{
            strokeDashoffset: 100 - drawProgress * 100,
            opacity: 0.18 + drawProgress * 0.82
          } as React.CSSProperties}
        />
        {coordinates.map((point, index) => (
          <circle
            cx={point.x}
            cy={point.y}
            r="7"
            key={`${point.label}-${index}`}
          />
        ))}
      </svg>
      {coordinates.map((point, index) => (
        <span
          className={`chart-hit ${activeIndex === index ? "active" : ""} ${index === 0 ? "edge-start" : ""} ${index === coordinates.length - 1 ? "edge-end" : ""}`}
          style={{
            left: `${Math.max(10, Math.min(90, (point.x / 160) * 100))}%`,
            top: `${Math.max(12, Math.min(88, (point.y / 52) * 100))}%`
          } as React.CSSProperties}
          tabIndex={0}
          aria-label={`${point.label}: ${point.display}`}
          onBlur={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(index)}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          key={`${point.label}-${index}-hit`}
        >
          <span className="chart-tooltip">
            <strong>{point.display}</strong>
            <span>{point.detail ?? point.label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

function QualityDonut({ percent, label }: { percent: number; label: string; }) {
  const [active, setActive] = useState(false);
  const clamped = Math.max(0, Math.min(100, percent));
  const drawProgress = useDrawProgress(`${clamped}:${label}`, 1600);
  const percentLabel = `${Math.round(clamped)}%`;
  return (
    <span
      className={`quality-donut-wrap ${active ? "active" : ""}`}
      tabIndex={0}
      aria-label={`Заполнение диаграммы: ${percentLabel}`}
      onBlur={() => setActive(false)}
      onFocus={() => setActive(true)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <svg className="quality-donut" viewBox="0 0 72 72" role="img" aria-label="Круговая диаграмма оценки качества">
        <circle className="quality-donut-backdrop" cx="36" cy="36" r="32" />
        <circle className="quality-donut-track" cx="36" cy="36" r="27" />
        <circle
          className="quality-donut-value"
          cx="36"
          cy="36"
          r="27"
          pathLength="100"
          strokeDasharray="100 100"
          strokeDashoffset={100 - clamped * drawProgress}
        />
        <circle className="quality-donut-core" cx="36" cy="36" r="18" />
      </svg>
      <span className="chart-tooltip donut-tooltip">
        <strong>{percentLabel}</strong>
        <span>заполнение диаграммы</span>
      </span>
    </span>
  );
}

function useDrawProgress(key: string, durationMs: number) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;

    setProgress(0);

    const tick = (time: number) => {
      if (!startedAt) startedAt = time;
      const rawProgress = Math.min(1, (time - startedAt) / durationMs);
      const easedProgress = 1 - Math.pow(1 - rawProgress, 3);
      setProgress(easedProgress);

      if (rawProgress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [durationMs, key]);

  return progress;
}

function buildOverviewChartSeries(overview: AnalyticsOverviewResponse | null) {
  const charts = overview?.charts;
  return {
    totalCalls: countChartPoints(charts?.calls_by_day, "загрузок"),
    analyzedCalls: analyzedChartPoints(charts?.analyzed_by_day),
    duration: durationChartPoints(charts?.duration_by_day),
    risks: countChartPoints(charts?.risks_by_day, "рисков"),
    quality: qualityChartPoints(charts?.quality_by_day, overview?.quality_score_scale ?? 5)
  };
}

function chartDateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function countChartPoints(points: Array<{ date: string; count: number }> | undefined, unit: string): ChartPoint[] {
  return (points ?? []).map((point) => ({
    label: chartDateLabel(point.date),
    value: point.count,
    display: `${point.count} ${unit}`
  }));
}

function analyzedChartPoints(points: Array<{ date: string; count: number }> | undefined): ChartPoint[] {
  return (points ?? []).map((point) => ({
    label: chartDateLabel(point.date),
    value: point.count,
    display: `${point.count} ${pluralizeCalls(point.count)}`,
    detail: `${chartDateLabel(point.date)} · получили AI-анализ`
  }));
}

function pluralizeCalls(count: number) {
  const abs = Math.abs(count);
  const lastTwo = abs % 100;
  const last = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "звонков";
  if (last === 1) return "звонок";
  if (last >= 2 && last <= 4) return "звонка";
  return "звонков";
}

function durationChartPoints(points: Array<{ date: string; average_duration_seconds: number }> | undefined): ChartPoint[] {
  return (points ?? []).map((point) => ({
    label: chartDateLabel(point.date),
    value: point.average_duration_seconds,
    display: formatDuration(Math.round(point.average_duration_seconds))
  }));
}

function qualityChartPoints(points: Array<{ date: string; average_quality_score: number }> | undefined, scale: number): ChartPoint[] {
  return (points ?? []).map((point) => ({
    label: chartDateLabel(point.date),
    value: point.average_quality_score,
    display: `${point.average_quality_score.toFixed(1).replace(".", ",")} / ${scale}`
  }));
}

function smoothPath(points: Array<ChartPoint & { x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function publicReportName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "последний экспорт";
}

function callSearchText(call: CallResponse) {
  const maybeNamedCall = call as CallResponse & { name?: unknown };
  return [
    call.title,
    typeof maybeNamedCall.name === "string" ? maybeNamedCall.name : "",
    call.original_filename
  ].join(" ").toLowerCase();
}

function ProgressRing({ percent, label }: { percent: number; label: string; }) {
  const clamped = Math.max(0, Math.min(percent, 100));
  return (
    <div className="progress-ring" style={{ "--score": clamped } as React.CSSProperties}>
      <span>{label}</span>
      <small>/5</small>
    </div>
  );
}

function qualityScore(analysis?: AnalysisResponse) {
  const result = analysis?.result_json;
  const record = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {};
  const rawScore = firstNumber(record, ["quality_score", "score", "overall_score", "manager_score"]);

  if (typeof rawScore !== "number") {
    return {
      value: "—",
      ringValue: "—",
      percent: 92,
      note: "нет поля оценки"
    };
  }

  const score = rawScore > 5 ? rawScore / 20 : rawScore;
  const formattedScore = score.toFixed(1).replace(".", ",");
  return {
    value: `${formattedScore} / 5`,
    ringValue: formattedScore,
    percent: Math.max(0, Math.min(100, (score / 5) * 100)),
    note: "из AI-анализа"
  };
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return undefined;
}
