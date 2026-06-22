import {
  ChevronRight,
  CloudUpload
} from "lucide-react";
import type {
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  TranscriptionResponse
} from "../../types";

import { CallDetailPanel } from "../calls/CallDetailPanel";

export function OverviewPage({
  calls,
  companies,
  departments,
  selectedCall,
  selectedCallTimeline,
  transcription,
  analysis,
  loading,
  loadingDetails,
  onNavigate
}: {
  calls: CallResponse[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  selectedCall?: CallResponse;
  selectedCallTimeline?: CallStatus[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  loading: boolean;
  loadingDetails: boolean;
  onNavigate: (page: AppPage) => void;
}) {
  const analyzedCount = calls.filter((call) => call.status === "analyzed").length;
  const processingCount = calls.filter((call) => call.status === "processing").length;
  const transcribedCount = calls.filter(
    (call) => call.status === "transcribed" || call.status === "analyzed"
  ).length;

  return (
    <section className="overview-layout">
      <div className="welcome-panel">
        <h1>Добрый день!</h1>
        <p>
          Загружайте звонки, выбирайте личный, корпоративный или отделский контекст и
          отслеживайте обработку в одном месте.
        </p>
        <div className="overview-actions">
          <button className="primary-button" onClick={() => onNavigate("upload")}>
            <CloudUpload size={18} />
            Загрузить звонок
          </button>
          <button className="ghost-button" onClick={() => onNavigate("calls")}>
            Открыть звонки
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="metrics-row">
        {loading ? (
          <>
            <MetricSkeleton title="Всего звонков" />
            <MetricSkeleton title="Проанализировано" />
            <MetricSkeleton title="В обработке" />
            <MetricSkeleton title="Расшифровано" />
          </>
        ) : (
          <>
            <Metric title="Всего звонков" value={calls.length.toString()} />
            <Metric title="Проанализировано" value={analyzedCount.toString()} />
            <Metric title="В обработке" value={processingCount.toString()} />
            <Metric title="Расшифровано" value={transcribedCount.toString()} />
          </>
        )}
      </div>
      <div className="overview-preview glass">
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
        />
      </div>
    </section>
  );
}

export function Metric({ title, value }: { title: string; value: string; }) {
  return (
    <div className="metric glass">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function MetricSkeleton({ title }: { title: string; }) {
  return (
    <div className="metric glass">
      <span>{title}</span>
      <span className="skeleton-line skeleton-metric-value" />
    </div>
  );
}
