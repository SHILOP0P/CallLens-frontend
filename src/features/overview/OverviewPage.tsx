import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Phone,
  Star,
  TriangleAlert
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type {
  AnalyticsOverviewResponse
} from "../../types";

import {
  businessOutcomeLabels,
  enumLabel,
  formatScore
} from "../../shared/lib/analysis";
import { formatDuration } from "../../shared/lib/formatters";

export function OverviewPage() {
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const avgDuration = analyticsOverview?.average_duration_seconds === null || analyticsOverview === null
    ? "Нет данных"
    : formatDuration(Math.round(analyticsOverview.average_duration_seconds));
  const analyticsScore = overviewScore(analyticsOverview);
  const riskValue = analyticsOverview?.risks_count ?? null;
  const recommendationValue = analyticsOverview?.recommendations_count ?? null;
  const chartSeries = buildOverviewChartSeries(analyticsOverview);
  const qualityDonutPercent = analyticsScore.score === null ? 0 : (analyticsScore.score / analyticsScore.scale) * 100;
  const qualityDonutLabel = analyticsScore.score === null
    ? "нет данных"
    : `${formatScore(analyticsScore.score)} / ${analyticsScore.scale}`;

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;

    async function loadOverview() {
      const overview = await api.getAnalyticsOverview().catch(() => null);
      if (!cancelled) setAnalyticsOverview(overview);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void loadOverview();
    }

    void loadOverview();
    intervalId = window.setInterval(loadOverview, 15000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, []);

  return (
    <section className="dashboard-page app-page">
      <div className="dashboard-kpi-grid">
        <MetricCard icon={<BarChart3 size={20} />} title="Всего звонков" value={metricCount(analyticsOverview?.calls_total)} points={chartSeries.totalCalls} note="загружено за период" />
        <MetricCard icon={<Phone size={20} />} title="Новые" value={metricCount(analyticsOverview?.calls_new)} note="ожидают обработки" />
        <MetricCard icon={<Activity size={20} />} title="В обработке" value={metricCount(analyticsOverview?.calls_processing)} note={`${analyticsOverview?.calls_failed ?? 0} ошибок`} />
        <MetricCard icon={<FileText size={20} />} title="Расшифрованы" value={metricCount(analyticsOverview?.calls_transcribed)} note="готовы к AI-анализу" />
        <MetricCard icon={<CheckCircle2 size={20} />} title="С анализом" value={metricCount(analyticsOverview?.calls_analyzed)} tone="success" points={chartSeries.analyzedCalls} note="готовый AI-результат" />
        <MetricCard icon={<Clock3 size={20} />} title="Средняя длительность" value={avgDuration} points={chartSeries.duration} />
        <MetricCard icon={<TriangleAlert size={20} />} title="Риски" value={riskValue === null ? "Нет данных" : riskValue.toString()} tone="warning" points={chartSeries.risks} />
        <MetricCard
          icon={<Star size={20} />}
          title="Средняя оценка"
          value={analyticsScore.score === null ? "Нет данных" : `${formatScore(analyticsScore.score)} / ${analyticsScore.scale}`}
          tone="success"
          points={chartSeries.quality}
          donutPercent={qualityDonutPercent}
          donutLabel={qualityDonutLabel}
        />
        <MetricCard icon={<FileText size={20} />} title="Рекомендации" value={recommendationValue === null ? "Нет данных" : recommendationValue.toString()} note="по результатам AI" />
        <MetricCard icon={<TriangleAlert size={20} />} title="Ошибки" value={metricCount(analyticsOverview?.calls_failed)} tone="warning" note="требуют внимания" />
      </div>

      <AnalyticsOverviewInsights overview={analyticsOverview} />
    </section>
  );
}

function AnalyticsOverviewInsights({ overview }: { overview: AnalyticsOverviewResponse | null; }) {
  const distribution = overview?.score_distribution;
  const distributionRows = distribution
    ? [
      ["critical", "Критично", distribution.critical],
      ["weak", "Слабо", distribution.weak],
      ["normal", "Норма", distribution.normal],
      ["good", "Хорошо", distribution.good],
      ["excellent", "Отлично", distribution.excellent]
    ] as Array<[string, string, number]>
    : [];
  const weakCriteria = overview?.top_weak_criteria ?? [];
  const criteriaSummary = overview?.criteria_summary ?? [];
  const issueCodes = overview?.top_issue_codes ?? [];
  const outcomes = overview?.business_outcomes ?? [];
  const nextSteps = overview?.next_step_summary;
  const topics = overview?.top_topics ?? [];

  return (
    <div className="analytics-insight-grid">
      <InsightCard title="Распределение оценок" note="score 0..100">
        {distributionRows.length === 0 ? (
          <p className="analysis-empty">Нет данных по распределению.</p>
        ) : (
          <div className="score-distribution-list">
            {distributionRows.map(([key, label, count]) => (
              <div className="score-distribution-row" key={key}>
                <span>{label}</span>
                <strong>{count}</strong>
                <i style={{ "--bar": overview?.calls_analyzed ? `${Math.min(100, (count / overview.calls_analyzed) * 100)}%` : "0%" } as React.CSSProperties} />
              </div>
            ))}
          </div>
        )}
      </InsightCard>

      <InsightCard title="Слабые критерии" note="по пропускам и частичным выполнением">
        {weakCriteria.length === 0 ? (
          <p className="analysis-empty">Слабые критерии не найдены.</p>
        ) : (
          <div className="analytics-list">
            {weakCriteria.slice(0, 5).map((item) => (
              <div className="analytics-list-row" key={item.code}>
                <div>
                  <strong>{item.title || item.code}</strong>
                  <small>
                    {item.missed_count} пропущено · {item.partially_met_count} частично
                  </small>
                </div>
                <span>{formatNullableScore(item.average_score)}</span>
              </div>
            ))}
          </div>
        )}
      </InsightCard>

      <InsightCard title="Критерии" note="not applicable учитывается отдельно">
        {criteriaSummary.length === 0 ? (
          <p className="analysis-empty">Сводка критериев пока пустая.</p>
        ) : (
          <div className="analytics-list">
            {criteriaSummary.slice(0, 6).map((item) => (
              <div className="analytics-list-row criteria" key={item.code}>
                <div>
                  <strong>{item.title || item.code}</strong>
                  <small>
                    {item.met} выполнено · {item.partially_met} частично · {item.missed} пропущено ·{" "}
                    {item.not_applicable} не применимо
                  </small>
                </div>
                <span>{formatNullableScore(item.average_score)}</span>
              </div>
            ))}
          </div>
        )}
      </InsightCard>

      <InsightCard title="Коды проблем" note="частые issue_codes">
        {issueCodes.length === 0 ? (
          <p className="analysis-empty">Коды проблем не указаны.</p>
        ) : (
          <div className="topic-list analytics-topic-list">
            {issueCodes.slice(0, 10).map((item) => (
              <span key={item.code}>{item.code} · {item.count}</span>
            ))}
          </div>
        )}
      </InsightCard>

      <InsightCard title="Темы" note="top_topics">
        {topics.length === 0 ? (
          <p className="analysis-empty">Темы пока не найдены.</p>
        ) : (
          <div className="topic-list analytics-topic-list">
            {topics.slice(0, 10).map((item) => (
              <span key={item.title}>{item.title} · {item.count}</span>
            ))}
          </div>
        )}
      </InsightCard>

      <InsightCard title="Итоги звонков" note="business_outcome">
        {outcomes.length === 0 ? (
          <p className="analysis-empty">Итоги звонков не указаны.</p>
        ) : (
          <div className="analytics-list compact">
            {outcomes.slice(0, 6).map((item) => (
              <div className="analytics-list-row" key={item.status}>
                <strong>{enumLabel(item.status, businessOutcomeLabels) ?? item.status}</strong>
                <span>{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </InsightCard>

      <InsightCard title="Следующий шаг" note="качество договоренности">
        {!nextSteps ? (
          <p className="analysis-empty">Сводка следующих шагов пустая.</p>
        ) : (
          <div className="analytics-list compact">
            <MetricLine label="Есть шаг" value={nextSteps.with_next_step} />
            <MetricLine label="Конкретный" value={nextSteps.specific} />
            <MetricLine label="Со сроком" value={nextSteps.with_deadline} />
            <MetricLine label="С ответственным" value={nextSteps.with_responsible_person} />
            <MetricLine label="Отсутствует" value={nextSteps.missing} />
          </div>
        )}
      </InsightCard>
    </div>
  );
}

function InsightCard({
  title,
  note,
  children
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="analytics-insight-card glass-panel">
      <div>
        <h3>{title}</h3>
        <small>{note}</small>
      </div>
      {children}
    </section>
  );
}

function MetricLine({ label, value }: { label: string; value: number; }) {
  return (
    <div className="analytics-list-row">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  tone = "accent",
  points,
  note,
  donutPercent,
  donutLabel
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  tone?: "accent" | "success" | "warning";
  points?: ChartPoint[];
  note?: string;
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
      ) : points && points.length > 0 ? (
        <MiniSparkline points={points} tone={tone} />
      ) : (
        <span className="dashboard-kpi-note">{note ?? "нет динамики"}</span>
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
    quality: qualityChartPoints(charts?.score_by_day, charts?.quality_by_day)
  };
}

function overviewScore(overview: AnalyticsOverviewResponse | null) {
  if (!overview) {
    return { score: null, scale: 100 };
  }

  if (typeof overview.average_score === "number" && Number.isFinite(overview.average_score)) {
    return {
      score: overview.average_score,
      scale: typeof overview.score_scale === "number" && overview.score_scale > 0 ? overview.score_scale : 100
    };
  }

  if (
    typeof overview.average_quality_score === "number" &&
    Number.isFinite(overview.average_quality_score)
  ) {
    return {
      score: overview.average_quality_score * 20,
      scale: 100
    };
  }

  return { score: null, scale: 100 };
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

function qualityChartPoints(
  scorePoints: Array<{ date: string; average_score: number }> | undefined,
  legacyPoints: Array<{ date: string; average_quality_score: number }> | undefined
): ChartPoint[] {
  if (scorePoints && scorePoints.length > 0) {
    return scorePoints.map((point) => ({
      label: chartDateLabel(point.date),
      value: point.average_score,
      display: `${formatScore(point.average_score)} / 100`
    }));
  }

  return (legacyPoints ?? []).map((point) => {
    const normalized = point.average_quality_score * 20;
    return {
      label: chartDateLabel(point.date),
      value: normalized,
      display: `${formatScore(normalized)} / 100`
    };
  });
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

function formatNullableScore(value: number | null) {
  return value === null ? "Нет данных" : `${formatScore(value)} / 100`;
}

function metricCount(value: number | null | undefined) {
  return typeof value === "number" ? value.toString() : "Нет данных";
}
