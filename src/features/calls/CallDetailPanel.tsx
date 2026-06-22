import {
  ChevronRight,
  CloudUpload,
  Headphones,
  Play,
  Trash2,
  WandSparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  TranscriptionResponse
} from "../../types";

import { analysisNextStep, isAnalysisDone } from "../../shared/lib/analysis";
import { contextLabel, formatDate, formatDuration } from "../../shared/lib/formatters";
import { AnalysisPreview } from "../../shared/ui/analysis";
import { InfoCard, StatusChip, StatusTimeline, TranscriptPreview } from "../../shared/ui/call";
import { CallDetailSkeleton } from "../../shared/ui/loading";
import { ReportExportPanel } from "../reports/ReportExportPanel";

export function CallDetailPanel({
  call,
  companies,
  departments,
  transcription,
  analysis,
  timelineStatuses,
  loading,
  loadingDetails,
  onNavigate,
  onDeleteCall,
  showReports = false
}: {
  call?: CallResponse;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  transcription?: TranscriptionResponse;
  analysis?: AnalysisResponse;
  timelineStatuses?: CallStatus[];
  loading?: boolean;
  loadingDetails?: boolean;
  onNavigate: (page: AppPage) => void;
  onDeleteCall?: (callId: string) => Promise<void>;
  showReports?: boolean;
}) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setShowFullTranscript(false);
    setShowFullAnalysis(false);
    setDeleteError("");
  }, [call?.id]);

  if (loading && !call) {
    return <CallDetailSkeleton />;
  }

  if (!call) {
    return (
      <div className="empty-panel">
        <Headphones size={34} />
        <h2>Звонков пока нет</h2>
        <p>Загрузите первый аудиофайл и выберите, кому он принадлежит.</p>
        <button className="primary-button" onClick={() => onNavigate("upload")}>
          <CloudUpload size={18} />
          Загрузить звонок
        </button>
      </div>
    );
  }

  async function deleteSelectedCall() {
    if (!call || !onDeleteCall || deleting) return;

    const confirmed = window.confirm(`Удалить звонок "${call.title}"? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await onDeleteCall(call.id);
    } catch (deleteCallError) {
      setDeleteError(deleteCallError instanceof Error ? deleteCallError.message : "Не удалось удалить звонок");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="panel-heading large">
        <h2>Обзор звонка</h2>
        <div className="panel-actions">
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <CloudUpload size={16} />
            Загрузить звонок
          </button>
          {onDeleteCall && (
            <button className="ghost-button small danger-button" onClick={deleteSelectedCall} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Удаляю..." : "Удалить"}
            </button>
          )}
        </div>
      </div>
      {deleteError && <div className="form-error">{deleteError}</div>}
      <div className="selected-call-card">
        <div className="play-large">
          <Play size={22} fill="currentColor" />
        </div>
        <div>
          <span>Выбранный звонок</span>
          <strong>{call.title}</strong>
          <small>
            {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)} ·{" "}
            {contextLabel(call, companies, departments)}
          </small>
        </div>
        <StatusChip status={call.status} />
      </div>
      <StatusTimeline current={call.status} statuses={timelineStatuses} />
      {showReports && <ReportExportPanel call={call} analysis={analysis} />}
      <div className="detail-grid">
        <InfoCard
          title="Расшифровка"
          status={transcription?.status === "transcribed" ? "Готово" : "Ожидает"}
          action={showFullTranscript ? "Свернуть расшифровку" : "Открыть полную расшифровку"}
          onAction={() => setShowFullTranscript((current) => !current)}
          actionVariant="analysis"
          expanded={showFullTranscript}
        >
          <TranscriptPreview transcription={transcription} expanded={showFullTranscript} loading={loadingDetails} />
        </InfoCard>
        <InfoCard
          title="AI-анализ"
          status={isAnalysisDone(analysis) ? "Анализ готов" : "Ожидает"}
          action={showFullAnalysis ? "Свернуть анализ" : "Открыть полный анализ"}
          onAction={() => setShowFullAnalysis((current) => !current)}
          actionVariant="analysis"
          expanded={showFullAnalysis}
        >
          <AnalysisPreview analysis={analysis} expanded={showFullAnalysis} loading={loadingDetails} />
        </InfoCard>
      </div>
      <div className="next-step">
        <span className="step-icon">
          <WandSparkles size={19} />
        </span>
        <div>
          <h3>Следующий шаг</h3>
          <p>{analysisNextStep(analysis)}</p>
        </div>
        <button className="ghost-button">
          Выполнить действие
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
