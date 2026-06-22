import {
  ChevronRight,
  CloudUpload,
  MoreVertical,
  Play
} from "lucide-react";
import { useState } from "react";
import type {
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  TranscriptionResponse,
  VisibilityScope
} from "../../types";

import { formatDate, formatDuration } from "../../shared/lib/formatters";
import { StatusChip } from "../../shared/ui/call";
import { CallListSkeleton } from "../../shared/ui/loading";
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
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onNavigate: (page: AppPage) => void;
  onDeleteCall?: (callId: string) => Promise<void>;
}) {
  const [scopeFilter, setScopeFilter] = useState<VisibilityScope | "all">("all");
  const effectiveScopeFilter =
    companies.length === 0 && (scopeFilter === "company" || scopeFilter === "department")
      ? "all"
      : scopeFilter;
  const filteredCalls = calls.filter(
    (call) => effectiveScopeFilter === "all" || call.visibility_scope === effectiveScopeFilter
  );
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

  return (
    <section className="calls-layout">
      <aside className="calls-sidebar glass">
        <div className="panel-heading">
          <h2>Звонки</h2>
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <CloudUpload size={16} />
            Загрузить звонок
          </button>
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
        <p className="muted-title">Недавние звонки</p>
        <div className="call-list">
          {loading && <CallListSkeleton count={4} />}
          {!loading &&
            filteredCalls.map((call) => (
              <button
                key={call.id}
                className={`call-row ${selectedCallId === call.id ? "selected" : ""}`}
                onClick={() => onSelectCall(call.id)}
              >
                <span className="play-dot">
                  <Play size={14} fill="currentColor" />
                </span>
                <span>
                  <strong>{call.title}</strong>
                  <small>
                    {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)}
                  </small>
                </span>
                <StatusChip status={call.status} />
                <MoreVertical size={16} />
              </button>
            ))}
          {!loading && filteredCalls.length === 0 && (
            <div className="empty-state">Звонков в этом контексте пока нет.</div>
          )}
        </div>
        <button className="ghost-button wide calls-show-all">
          Показать все звонки
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
          showReports
        />
      </section>
    </section>
  );
}
