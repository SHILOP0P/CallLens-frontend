import {
  Check,
  ChevronRight,
  CloudUpload,
  FileText,
  RefreshCw,
  X
} from "lucide-react";
import type {
  AnalysisResponse,
  CallStatus,
  TranscriptionResponse
} from "../../types";

import {
  activeCallProcess,
  callStatusChip,
  callStatusTone,
  normalTimelineSteps,
  statusMeta,
  timelineFromStatus
} from "../lib/call-status";
import { formatSegmentTimeRange, speakerLabel } from "../lib/formatters";
import { TextBlockSkeleton } from "./loading";

type StatusTone = "ok" | "warn" | "bad";

export function StatusChip({
  status,
  analysisStatus
}: {
  status: CallStatus;
  analysisStatus?: AnalysisResponse["status"];
}) {
  return <span className={`status-chip ${callStatusTone(status, analysisStatus)}`}>{callStatusChip(status, analysisStatus)}</span>;
}

export function StatusTimeline({
  current,
  statuses,
  analysisStatus
}: {
  current: CallStatus;
  statuses?: CallStatus[];
  analysisStatus?: AnalysisResponse["status"];
}) {
  const steps = visibleTimelineSteps(current, statuses);
  const currentIndex = steps.indexOf(current);

  return (
    <div
      className="status-timeline"
      style={{ "--timeline-steps": steps.length } as React.CSSProperties}
    >
      {steps.map((step, index) => (
        <div
          className={`timeline-step ${timelineStepClass(step, index, current, currentIndex, analysisStatus)}`}
          key={step}
        >
          <span>
            {step === "new" && <CloudUpload size={19} />}
            {step === "processing" && <RefreshCw size={19} />}
            {step === "transcribed" && <FileText size={19} />}
            {step === "analyzed" && <Check size={19} />}
            {step === "failed" && <X size={19} />}
          </span>
          <strong>{statusMeta[step].label}</strong>
          <small>{timelineStepCaption(step, index, current, currentIndex, analysisStatus)}</small>
        </div>
      ))}
    </div>
  );
}

function visibleTimelineSteps(current: CallStatus, statuses?: CallStatus[]) {
  if (current !== "failed") return normalTimelineSteps;
  if (!statuses?.length) return timelineFromStatus(current);

  const currentIndex = statuses.indexOf(current);
  if (currentIndex >= 0) return statuses.slice(0, currentIndex + 1);

  return timelineFromStatus(current);
}

function timelineStepClass(
  step: CallStatus,
  index: number,
  current: CallStatus,
  currentIndex: number,
  analysisStatus?: AnalysisResponse["status"]
) {
  const activeProcess = activeCallProcess(current, analysisStatus);

  if (step === "failed") return "danger";
  if (analysisStatus === "failed" && step === "analyzed") return "danger current";
  if (activeProcess === "transcription" && step === "processing") return "processing current";
  if (activeProcess === "analysis" && step === "analyzed") return "processing current";
  if (isTimelineStepReady(step, current, index, currentIndex, analysisStatus)) return "ready";
  return "";
}

function timelineStepCaption(
  step: CallStatus,
  index: number,
  current: CallStatus,
  currentIndex: number,
  analysisStatus?: AnalysisResponse["status"]
) {
  const activeProcess = activeCallProcess(current, analysisStatus);

  if (step === "failed") return "ошибка";
  if (analysisStatus === "failed" && step === "analyzed") return "ошибка анализа";
  if (activeProcess === "transcription" && step === "processing") return "Транскрибируется";
  if (activeProcess === "analysis" && step === "analyzed") return "Производится анализ транскрипции";
  if (isTimelineStepReady(step, current, index, currentIndex, analysisStatus)) return "готово";
  return "";
}

function isTimelineStepReady(
  step: CallStatus,
  current: CallStatus,
  index: number,
  currentIndex: number,
  analysisStatus?: AnalysisResponse["status"]
) {
  if (step === "new" && current !== "failed") return true;
  if (step === "processing") return current === "transcribed" || current === "analyzed" || analysisStatus === "done";
  if (step === "transcribed") return current === "transcribed" || current === "analyzed" || analysisStatus === "done";
  if (step === "analyzed") return current === "analyzed" || analysisStatus === "done";
  return index <= currentIndex || currentIndex === -1;
}

export function InfoCard({
  title,
  status,
  statusTone = "ok",
  statusThinking = false,
  action,
  children,
  onAction,
  actionVariant = "link",
  expanded = false
}: {
  title: string;
  status: string;
  statusTone?: StatusTone;
  statusThinking?: boolean;
  action: string;
  children: React.ReactNode;
  onAction?: () => void;
  actionVariant?: "link" | "analysis";
  expanded?: boolean;
}) {
  return (
    <div className="info-card">
      <div className="card-title">
        <h3>{title}</h3>
        <span className={`status-chip ${statusTone} ${statusThinking ? "thinking-status" : ""}`}>{status}</span>
      </div>
      {children}
      {actionVariant === "analysis" ? (
        <button
          className={`analysis-toggle-button ${expanded ? "expanded" : ""}`}
          type="button"
          aria-expanded={expanded}
          onClick={onAction}
        >
          <span>{action}</span>
          <span className="analysis-toggle-icon">
            <ChevronRight size={18} />
          </span>
        </button>
      ) : (
        <button className="text-link" type="button" onClick={onAction}>
          {action}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export function TranscriptPreview({
  transcription,
  expanded,
  loading
}: {
  transcription?: TranscriptionResponse;
  expanded: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <TextBlockSkeleton rows={4} />;
  }

  const segments = transcriptionSegments(transcription);

  if (segments.length > 0) {
    return (
      <div className={`transcript-preview segmented expandable-content ${expanded ? "expanded" : "collapsed"}`}>
        {segments.map((segment, index) => (
          <div className="transcript-segment" key={`${segment.start_seconds ?? index}-${segment.text}`}>
            <div className="segment-meta">
              <strong>{speakerLabel(segment.speaker)}</strong>
              <span>{formatSegmentTimeRange(segment.start_seconds, segment.end_seconds)}</span>
            </div>
            <p>{segment.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (!transcription?.text) {
    return <p className="muted">Расшифровка появится после обработки звонка.</p>;
  }

  return (
    <div className={`transcript-preview fallback expandable-content ${expanded ? "expanded" : "collapsed"}`}>
      {transcription.text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
    </div>
  );
}

export function transcriptionSegments(transcription?: TranscriptionResponse) {
  const segments = transcription?.segments;
  if (!Array.isArray(segments)) return [];

  const nonEmptySegments = segments.filter((segment) => segment.text.trim().length > 0);

  // A continuous transcript must not be presented as a diarized dialogue.
  // This also keeps old Start transcriptions readable after the tariff rule
  // changed: no speaker label means no segment metadata at all.
  if (nonEmptySegments.some((segment) => !segment.speaker?.trim())) return [];

  return nonEmptySegments;
}
