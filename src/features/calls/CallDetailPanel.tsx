import {
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  FolderMinus,
  FolderPlus,
  Headphones,
  PhoneCall,
  Trash2,
  WandSparkles
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  AnalysisResponse,
  AppPage,
  CallFolderResponse,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  MediaSeekTarget,
  TranscriptionResponse,
  TranscriptionSpeakerAssignment
  , TranscriptionRevisionSummary
} from "../../types";
import { api } from "../../api";

import { analysisNextStep, analysisScore100, formatScore, isAnalysisDone } from "../../shared/lib/analysis";
import { contextLabel, formatDate, formatDuration } from "../../shared/lib/formatters";
import { AnalysisPreview } from "../../shared/ui/analysis";
import { CallMediaPlayer } from "../../shared/ui/audio";
import { InfoCard, StatusChip, StatusTimeline, TranscriptPreview } from "../../shared/ui/call";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { CallDetailSkeleton } from "../../shared/ui/loading";
import { ReportExportPanel } from "../reports/ReportExportPanel";

type CardProcessState = {
  label: string;
  tone: "ok" | "warn" | "bad";
  thinking?: boolean;
};

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
  onOpenTranscriptionEditor,
  onOpenRevisionComparison,
  folders = [],
  activeFolder,
  folderActionBusy = false,
  onAssignToFolder,
  onRemoveFromFolder,
  drawerTrigger,
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
  onOpenTranscriptionEditor?: (callId: string) => void;
  onOpenRevisionComparison?: (callId: string, revision?: number) => void;
  folders?: CallFolderResponse[];
  activeFolder?: CallFolderResponse;
  folderActionBusy?: boolean;
  onAssignToFolder?: (folderId: string, callId: string) => Promise<void>;
  onRemoveFromFolder?: (folderId: string, callId: string) => Promise<void>;
  drawerTrigger?: ReactNode;
  showReports?: boolean;
}) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [seekTarget, setSeekTarget] = useState<MediaSeekTarget | null>(null);
  const [localTranscription, setLocalTranscription] = useState(transcription);
  const [revisions, setRevisions] = useState<TranscriptionRevisionSummary[]>([]);
  const [speakerAssignments, setSpeakerAssignments] = useState<TranscriptionSpeakerAssignment[]>([]);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectingRevision, setSelectingRevision] = useState<number | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const transcriptCardRef = useRef<HTMLDivElement | null>(null);
  const analysisCardRef = useRef<HTMLDivElement | null>(null);
  const score = analysisScore100(analysis);

  useEffect(() => {
    setShowFullTranscript(false);
    setShowFullAnalysis(false);
    setDeleteError("");
    setDeleteConfirmOpen(false);
    setFolderMenuOpen(false);
    setActiveWordIndex(-1);
    setSeekTarget(null);
  }, [call?.id]);

  useEffect(() => { setLocalTranscription(transcription); }, [transcription]);
  useEffect(() => { setRevisions([]); setShowRevisionHistory(false); }, [call?.id]);
  useEffect(() => {
    if (!call) { setSpeakerAssignments([]); return; }
    let cancelled = false;
    void api.listTranscriptionSpeakerAssignments(call.id)
      .then((items) => { if (!cancelled) setSpeakerAssignments(items); })
      .catch(() => { if (!cancelled) setSpeakerAssignments([]); });
    return () => { cancelled = true; };
  }, [call?.id, transcription?.updated_at]);

  useEffect(() => {
    if (!folderMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!folderMenuRef.current?.contains(event.target)) {
        setFolderMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFolderMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [folderMenuOpen]);

  if (loading && !call) {
    return (
      <>
        {drawerTrigger}
        <CallDetailSkeleton />
      </>
    );
  }

  if (!call) {
    return (
      <>
        {drawerTrigger}
        <div className="empty-panel">
          <Headphones size={34} />
          <h2>Звонков пока нет</h2>
          <p>Загрузите первый аудиофайл и выберите, кому он принадлежит.</p>
          <button className="primary-button" onClick={() => onNavigate("upload")}>
            <CloudUpload size={18} />
            Загрузить звонок
          </button>
        </div>
      </>
    );
  }

  const transcriptionState = transcriptionCardState(call, transcription);
  const analysisState = analysisCardState(call, analysis);

  function openEvidence(target: MediaSeekTarget) {
    setShowFullTranscript(true);
    setSeekTarget({ ...target });
  }

  function toggleExpandedCard(
    expanded: boolean,
    setExpanded: React.Dispatch<React.SetStateAction<boolean>>,
    cardRef: React.RefObject<HTMLDivElement | null>
  ) {
    setExpanded((current) => !current);
    if (expanded) {
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "nearest" }));
    }
  }

  async function deleteSelectedCall() {
    if (!call || !onDeleteCall || deleting) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await onDeleteCall(call.id);
      setDeleteConfirmOpen(false);
    } catch (deleteCallError) {
      setDeleteError(deleteCallError instanceof Error ? deleteCallError.message : "Не удалось удалить звонок");
    } finally {
      setDeleting(false);
    }
  }

  async function loadRevisionHistory() {
    if (!call) return;
    setHistoryLoading(true); setHistoryError("");
    try { const result = await api.listTranscriptionRevisions(call.id); setRevisions(result.items); setShowRevisionHistory(true); }
    catch (error) { setHistoryError(error instanceof Error ? error.message : "Не удалось загрузить историю"); }
    finally { setHistoryLoading(false); }
  }

  async function toggleRevisionHistory() {
    if (showRevisionHistory) {
      setShowRevisionHistory(false);
      setHistoryError("");
      return;
    }
    await loadRevisionHistory();
  }

  async function restoreRevision(revision: TranscriptionRevisionSummary) {
    if (!call) return;
    setSelectingRevision(revision.revision); setHistoryError("");
    try {
      const result = await api.restoreTranscriptionRevision(call.id, revision.revision, localTranscription?.revision ?? 1);
      setLocalTranscription(result.transcription);
      const history = await api.listTranscriptionRevisions(call.id);
      setRevisions(history.items);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Не удалось выбрать версию транскрипции");
    } finally { setSelectingRevision(null); }
  }

  return (
    <>
      <div className="panel-heading large">
        <h2>Обзор звонка</h2>
        {drawerTrigger}
        <div className="panel-actions">
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <CloudUpload size={16} />
            Загрузить звонок
          </button>
          {(onAssignToFolder || (activeFolder && onRemoveFromFolder)) && (
            <div className="call-folder-action-menu" ref={folderMenuRef}>
              {activeFolder && onRemoveFromFolder ? (
                <button
                  className="ghost-button small"
                  type="button"
                  disabled={folderActionBusy}
                  title={activeFolder.name}
                  onClick={async () => {
                    setFolderMenuOpen(false);
                    await onRemoveFromFolder(activeFolder.id, call.id);
                  }}
                >
                  <FolderMinus size={16} />
                  Убрать из папки
                </button>
              ) : (
                <button
                  className="ghost-button small"
                  type="button"
                  disabled={folderActionBusy || folders.length === 0}
                  aria-expanded={folderMenuOpen}
                  onClick={() => setFolderMenuOpen((current) => !current)}
                >
                  <FolderPlus size={16} />
                  Добавить в папку
                </button>
              )}
              {folderMenuOpen && onAssignToFolder && !activeFolder && (
                <div className="call-folder-dropdown">
                  {folders.length === 0 ? (
                    <div className="empty-state compact">Сначала создайте папку.</div>
                  ) : (
                    folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        disabled={folderActionBusy}
                        onClick={async () => {
                          setFolderMenuOpen(false);
                          await onAssignToFolder(folder.id, call.id);
                        }}
                      >
                        <span
                          className="folder-color-dot"
                          style={{ "--folder-color": folder.color || "#ff7a43" } as CSSProperties}
                        />
                        <span>
                          <strong>{folder.name}</strong>
                          <small>{folder.calls_count} звонков</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {onDeleteCall && (
            <button className="ghost-button small danger-button" onClick={() => setDeleteConfirmOpen(true)} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Удаляю..." : "Удалить"}
            </button>
          )}
        </div>
      </div>
      {deleteError && <div className="form-error">{deleteError}</div>}
      <div className="selected-call-card">
        <div className="play-large">
          <PhoneCall size={22} />
        </div>
        <div className="selected-call-main">
          <StatusChip status={call.status} analysisStatus={analysis?.status} />
          <strong>{call.title}</strong>
          <small>
            {formatDate(call.created_at)} · {formatDuration(call.duration_seconds)} ·{" "}
            {contextLabel(call, companies, departments)}
          </small>
          {score.score !== null && (
            <span className="call-score-chip">Оценка {formatScore(score.percent)} / 100</span>
          )}
        </div>
      </div>
      <CallMediaPlayer
        call={call}
        words={localTranscription?.words}
        seekTarget={seekTarget}
        onActiveWordChange={setActiveWordIndex}
      />
      <StatusTimeline current={call.status} statuses={timelineStatuses} analysisStatus={analysis?.status} />
      {showReports && <ReportExportPanel call={call} analysis={analysis} />}
      <div className="detail-grid">
        <InfoCard
          title="Расшифровка"
          cardRef={transcriptCardRef}
          status={transcriptionState.label}
          statusTone={transcriptionState.tone}
          statusThinking={transcriptionState.thinking}
          action={showFullTranscript ? "Свернуть расшифровку" : "Открыть полную расшифровку"}
          onAction={() => toggleExpandedCard(showFullTranscript, setShowFullTranscript, transcriptCardRef)}
          actionVariant="analysis"
          expanded={showFullTranscript}
        >
          {localTranscription?.editable && (
            <div className="transcript-history-actions">
              <div className="transcript-history-toolbar">
                {onOpenTranscriptionEditor && <button type="button" className="primary-button small" onClick={() => onOpenTranscriptionEditor(call.id)}>Исправить транскрипцию</button>}
                <button type="button" className="ghost-button small" disabled={historyLoading} aria-expanded={showRevisionHistory} onClick={() => void toggleRevisionHistory()}>
                  {historyLoading ? "Загружаю историю…" : showRevisionHistory ? "Свернуть историю" : "История исправлений"}
                </button>
                {(localTranscription.revision ?? 1) > 1 && onOpenRevisionComparison && <button type="button" className="ghost-button small" onClick={() => onOpenRevisionComparison(call.id)}>Сравнить версии</button>}
              </div>
              {historyError && <div className="form-error">{historyError}</div>}
              {showRevisionHistory && <div className="transcript-history-list">
                {revisions.length === 0 ? <small>Версий пока нет.</small> : revisions.map((revision) => <div className={`transcript-history-row${revision.is_current ? " is-current" : ""}`} key={revision.id}>
                  <button type="button" className="transcript-history-preview-button" onClick={() => onOpenRevisionComparison?.(call.id, revision.revision)} aria-label={`Сравнить версию ${revision.revision}`}>
                    <span><strong>Версия {revision.revision}</strong><small>{revision.is_current ? "Используется сейчас" : "Нажмите для сравнения"}</small></span>
                  </button>
                  {revision.is_current
                    ? <span className="transcript-current-revision"><CheckCircle2 size={18} /> Выбрана</span>
                    : <button type="button" className="ghost-button small" disabled={selectingRevision !== null} onClick={() => void restoreRevision(revision)}>{selectingRevision === revision.revision ? "Выбираю…" : "Выбрать"}</button>}
                </div>)}
              </div>}
            </div>
          )}
          <TranscriptPreview
            transcription={localTranscription}
            expanded={showFullTranscript}
            loading={loadingDetails}
            activeWordIndex={activeWordIndex}
            selectedEvidence={seekTarget}
            speakerAssignments={speakerAssignments}
          />
        </InfoCard>
        <InfoCard
          title="AI-анализ"
          cardRef={analysisCardRef}
          status={analysisState.label}
          statusTone={analysisState.tone}
          statusThinking={analysisState.thinking}
          action={showFullAnalysis ? "Свернуть анализ" : "Открыть полный анализ"}
          onAction={() => toggleExpandedCard(showFullAnalysis, setShowFullAnalysis, analysisCardRef)}
          actionVariant="analysis"
          expanded={showFullAnalysis}
        >
          <AnalysisPreview
            analysis={analysis}
            expanded={showFullAnalysis}
            loading={loadingDetails}
            pendingMessage={analysisState.thinking ? "Производится анализ транскрипции. Результат появится после завершения обработки." : undefined}
            onEvidenceActivate={openEvidence}
          />
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
      <ConfirmDialog
        open={deleteConfirmOpen}
        variant="danger"
        title="Удалить звонок?"
        message={`Звонок «${call.title}» будет удален без возможности восстановления.`}
        confirmLabel="Удалить"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => void deleteSelectedCall()}
      />
    </>
  );
}

function transcriptionCardState(
  call: CallResponse,
  transcription?: TranscriptionResponse
): CardProcessState {
  if (call.status === "failed" || transcription?.status === "failed") {
    return { label: "Ошибка", tone: "bad" };
  }

  if (transcription?.status === "transcribed" || call.status === "transcribed" || call.status === "analyzed") {
    return { label: "Готово", tone: "ok" };
  }

  if (call.status === "processing" || transcription?.status === "processing") {
    return { label: "Транскрибируется", tone: "warn", thinking: true };
  }

  return { label: "Ожидает", tone: "warn" };
}

function analysisCardState(
  call: CallResponse,
  analysis?: AnalysisResponse
): CardProcessState {
  if (analysis?.status === "failed") {
    return { label: "Ошибка анализа", tone: "bad" };
  }

  if (call.status === "failed") {
    return { label: "Ошибка", tone: "bad" };
  }

  if (call.status === "transcribed" || analysis?.status === "pending" || analysis?.status === "processing") {
    return { label: "Производится анализ транскрипции", tone: "warn", thinking: true };
  }

  if (isAnalysisDone(analysis) || call.status === "analyzed") {
    return { label: "Анализ готов", tone: "ok" };
  }

  if (call.status === "processing") {
    return { label: "Ожидает расшифровку", tone: "warn" };
  }

  return { label: "Ожидает", tone: "warn" };
}
