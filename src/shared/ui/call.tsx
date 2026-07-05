import {
  Check,
  ChevronRight,
  CloudUpload,
  FileText,
  RefreshCw,
  X
} from "lucide-react";
import type {
  CallStatus,
  TranscriptionResponse
} from "../../types";

import { statusMeta, timelineFromStatus } from "../lib/call-status";
import { formatSegmentTimeRange, speakerLabel } from "../lib/formatters";
import { TextBlockSkeleton } from "./loading";

export function StatusChip({ status }: { status: CallStatus; }) {
  const className = status === "failed" ? "bad" : status === "processing" ? "warn" : "ok";
  return <span className={`status-chip ${className}`}>{statusMeta[status].chip}</span>;
}

export function StatusTimeline({
  current,
  statuses
}: {
  current: CallStatus;
  statuses?: CallStatus[];
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
          className={`timeline-step ${timelineStepClass(step, index, current, currentIndex)}`}
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
          <small>{timelineStepCaption(step, index, current, currentIndex)}</small>
        </div>
      ))}
    </div>
  );
}

function visibleTimelineSteps(current: CallStatus, statuses?: CallStatus[]) {
  if (!statuses?.length) return timelineFromStatus(current);

  const currentIndex = statuses.indexOf(current);
  if (currentIndex >= 0) return statuses.slice(0, currentIndex + 1);

  return timelineFromStatus(current);
}

function timelineStepClass(
  step: CallStatus,
  index: number,
  current: CallStatus,
  currentIndex: number
) {
  if (step === "failed") return "danger";
  if (step === "processing" && step === current) return "processing current";
  if (index <= currentIndex || currentIndex === -1) return "ready";
  return "";
}

function timelineStepCaption(
  step: CallStatus,
  index: number,
  current: CallStatus,
  currentIndex: number
) {
  if (step === "failed") return "ошибка";
  if (step === "processing" && step === current) return "в обработке";
  if (index <= currentIndex || currentIndex === -1) return "готово";
  return "";
}

export function InfoCard({
  title,
  status,
  action,
  children,
  onAction,
  actionVariant = "link",
  expanded = false
}: {
  title: string;
  status: string;
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
        <span className="status-chip ok">{status}</span>
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
              <span>{formatSegmentTimeRange(segment.start_seconds, segment.end_seconds)}</span>
              <strong>{speakerLabel(segment.speaker)}</strong>
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

  return segments.filter((segment) => segment.text.trim().length > 0);
}
