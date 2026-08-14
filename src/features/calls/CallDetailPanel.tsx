import {
  CheckCircle2,
  ClipboardCheck,
  ChevronRight,
  ChevronUp,
  CloudUpload,
  FolderMinus,
  FolderPlus,
  Headphones,
  MessageSquareWarning,
  PhoneCall,
  Trash2,
  WandSparkles
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import type {
  AnalysisResponse,
  AnalysisReviewContext,
  AppPage,
  CallFolderResponse,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  EffectiveAnalysis,
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
import { AnalysisComments } from "./AnalysisComments";

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
  onAnalysisReady,
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
  onAnalysisReady?: (callId: string, analysis: AnalysisResponse) => void;
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
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisRunError, setAnalysisRunError] = useState("");
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
  const [qualityReviewBusy, setQualityReviewBusy] = useState(false);
  const [qualityReviewError, setQualityReviewError] = useState("");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeReason, setChallengeReason] = useState("");
  const [challengeSent, setChallengeSent] = useState(false);
  const [reviewContext, setReviewContext] = useState<AnalysisReviewContext>();
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const transcriptCardRef = useRef<HTMLDivElement | null>(null);
  const transcriptIslandRef = useRef<HTMLDivElement | null>(null);
  const analysisCardRef = useRef<HTMLDivElement | null>(null);
  const displayedAnalysis = applyEffectiveAnalysis(analysis, reviewContext?.effective_analysis);
  const score = analysisScore100(displayedAnalysis);
  const canEditAnalysis = reviewContext?.capabilities.can_edit_analysis === true;
  const canDisputeAnalysis = reviewContext?.capabilities.can_dispute_analysis === true;

  async function createQualityReview() {
    if (!call || !analysis || qualityReviewBusy) return;
    setQualityReviewBusy(true); setQualityReviewError("");
    try {
      const reviewId = reviewContext?.review_uuid ?? (await api.createQualityReview(call.id, { analysis_uuid: analysis.id })).review_uuid;
      window.history.pushState({}, "", `/app/quality-reviews/${encodeURIComponent(reviewId)}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (cause) {
      setQualityReviewError(cause instanceof Error ? cause.message : "Не удалось создать проверку");
    } finally { setQualityReviewBusy(false); }
  }

  async function challengeAnalysis() {
    if (!call || !analysis || qualityReviewBusy || challengeReason.trim().length < 10) return;
    setQualityReviewBusy(true); setQualityReviewError("");
    try {
      await api.challengeCallAnalysis(call.id, analysis.id, challengeReason.trim());
      setChallengeOpen(false); setChallengeReason(""); setChallengeSent(true);
      setReviewContext(await api.getAnalysisReviewContext(call.id, analysis.id));
    } catch (cause) {
      setQualityReviewError(cause instanceof Error ? cause.message : "Не удалось отправить анализ на пересмотр");
    } finally { setQualityReviewBusy(false); }
  }

  async function runAnalysis() {
    if (!call || analysisBusy) return;
    setAnalysisBusy(true);
    setAnalysisRunError("");
    setChallengeOpen(false);
    setChallengeReason("");
    setChallengeSent(false);
    try {
      const result = await api.analyzeCall(call.id);
      onAnalysisReady?.(call.id, result);
    } catch (cause) {
      setAnalysisRunError(cause instanceof Error ? cause.message : "Не удалось запустить анализ");
    } finally {
      setAnalysisBusy(false);
    }
  }

  useEffect(() => {
    setShowFullTranscript(false);
    setShowFullAnalysis(false);
    setDeleteError("");
    setAnalysisRunError("");
    setDeleteConfirmOpen(false);
    setFolderMenuOpen(false);
    setActiveWordIndex(-1);
    setSeekTarget(null);
  }, [call?.id]);

  useEffect(() => {
    let cancelled = false;
    setReviewContext(undefined);
    setChallengeSent(false);
    if (!call || !analysis || !isAnalysisDone(analysis)) return;
    void api.getAnalysisReviewContext(call.id, analysis.id)
      .then((value) => {
        if (!cancelled) {
          setReviewContext(value);
          setChallengeSent(Boolean(value.challenge) || value.status === "appealed");
        }
      })
      .catch(() => { if (!cancelled) setReviewContext(undefined); });
    return () => { cancelled = true; };
  }, [call?.id, analysis?.id, analysis?.status]);

  useEffect(() => {
    if (!qualityReviewError) return;
    const timer = window.setTimeout(() => setQualityReviewError(""), 5200);
    return () => window.clearTimeout(timer);
  }, [qualityReviewError]);

  useEffect(() => {
    if (!analysisRunError) return;
    const timer = window.setTimeout(() => setAnalysisRunError(""), 5200);
    return () => window.clearTimeout(timer);
  }, [analysisRunError]);

  useLayoutEffect(() => {
    const card = transcriptCardRef.current;
    const island = transcriptIslandRef.current;
    if (!showFullTranscript || !card || !island) return;
    const scrollArea = card.closest(".call-overview");
    const mainToggle = card.querySelector<HTMLElement>(":scope > .analysis-toggle-button");
    if (!mainToggle) {
      island.hidden = true;
      return;
    }
    let cardVisible = true;
    let islandBottom = window.innerHeight - 10;
    let lastCollision = "";
    let lastHidden: boolean | null = null;
    let lastReceiving: boolean | null = null;

    const measureLayout = () => {
      const rect = card.getBoundingClientRect();
      const areaRect = scrollArea?.getBoundingClientRect() ?? { bottom: window.innerHeight };
      islandBottom = areaRect.bottom - 10;
      island.style.setProperty("--island-left", `${rect.left + rect.width / 2}px`);
      island.style.setProperty("--island-bottom", `${Math.max(0, window.innerHeight - areaRect.bottom) + 10}px`);
    };
    const updatePosition = () => {
      const toggleRect = mainToggle.getBoundingClientRect();
      const distanceToIsland = toggleRect.top - islandBottom;
      const collisionApproachDistance = 96;
      const collision = Math.min(1, Math.max(0, (collisionApproachDistance - distanceToIsland) / collisionApproachDistance));
      const crossed = distanceToIsland <= 0;
      const collisionValue = collision.toFixed(3);
      const hidden = !cardVisible || crossed;
      const receiving = collision > 0 && !crossed;

      if (collisionValue !== lastCollision) {
        island.style.setProperty("--island-collision", collisionValue);
        mainToggle.style.setProperty("--island-collision", collisionValue);
        lastCollision = collisionValue;
      }
      if (hidden !== lastHidden) {
        island.hidden = hidden;
        lastHidden = hidden;
      }
      if (receiving !== lastReceiving) {
        mainToggle.classList.toggle("is-island-receiving", receiving);
        lastReceiving = receiving;
      }
    };
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };
    const measureAndSchedule = () => {
      measureLayout();
      scheduleUpdate();
    };
    measureAndSchedule();
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      cardVisible = entry?.isIntersecting ?? false;
      scheduleUpdate();
    }, { root: scrollArea });
    intersectionObserver.observe(card);
    const resizeObserver = new ResizeObserver(measureAndSchedule);
    resizeObserver.observe(card);
    if (scrollArea) resizeObserver.observe(scrollArea);
    scrollArea?.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", measureAndSchedule);
    return () => {
      window.cancelAnimationFrame(frame);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      scrollArea?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", measureAndSchedule);
      mainToggle.classList.remove("is-island-receiving");
      mainToggle.style.removeProperty("--island-collision");
    };
  }, [showFullTranscript, call?.id]);

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
            <button className="ghost-button small call-analysis-button" type="button" onClick={() => void runAnalysis()} disabled={analysisBusy}>
              <WandSparkles size={16} />
              {analysisBusy ? "Анализирую…" : "Сделать анализ"}
            </button>
          )}
          {onDeleteCall && (
            <button className="ghost-button small danger-button" onClick={() => setDeleteConfirmOpen(true)} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Удаляю..." : "Удалить"}
            </button>
          )}
        </div>
      </div>
      {analysisRunError && <div className="form-error is-dismissible" role="alert">{analysisRunError}</div>}
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
          className="transcript-card"
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
          {showFullTranscript && createPortal(
            <div ref={transcriptIslandRef} className="transcript-collapse-island">
              <button type="button" onClick={() => toggleExpandedCard(true, setShowFullTranscript, transcriptCardRef)}>
                <ChevronUp size={18} />
                Свернуть расшифровку
              </button>
            </div>,
            document.body
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
        <div className="analysis-card-stack">
          {isAnalysisDone(analysis) && reviewContext && (canEditAnalysis || canDisputeAnalysis || reviewContext.human_review_count > 0) && <div className="quality-review-entry"><div><ClipboardCheck size={20} /><span><strong>{reviewContext.human_review_count > 0 ? `Действует человеческая оценка ${reviewContext.human_review_count}` : "Проверка человеком"}</strong><small>{reviewContext.source_outdated ? "Эта проверка относится к устаревшей версии анализа и доступна только для просмотра." : canEditAnalysis ? `Опубликовано ${reviewContext.human_review_count} из ${reviewContext.human_review_limit} допустимых переоценок.${reviewContext.next_review_requires_different_author ? " Следующую должен выполнить другой проверяющий." : ""}` : canDisputeAnalysis ? "Если выводы или оценки неверны, отправьте анализ своего звонка на независимый пересмотр." : "Доступны просмотр и история оценок."}</small></span></div><div className="quality-review-entry-actions">{canEditAnalysis && <button className="primary-button" type="button" disabled={qualityReviewBusy} onClick={() => void createQualityReview()}>{qualityReviewBusy ? "Открываю…" : "Исправить анализ"}</button>}{reviewContext.review_uuid && !canEditAnalysis && reviewContext.human_review_count > 0 && <button className="ghost-button" type="button" onClick={() => { window.history.pushState({}, "", `/app/quality-reviews/${encodeURIComponent(reviewContext.review_uuid!)}`); window.dispatchEvent(new PopStateEvent("popstate")); }}>История оценок</button>}{canDisputeAnalysis && <button className="ghost-button" type="button" disabled={qualityReviewBusy || challengeSent} onClick={() => setChallengeOpen(true)}><MessageSquareWarning size={17} />{challengeSent ? "Отправлено на пересмотр" : "Оспорить анализ"}</button>}</div></div>}
          {qualityReviewError && <div className="form-error is-dismissible" role="alert">{qualityReviewError}</div>}
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
              analysis={displayedAnalysis}
              expanded={showFullAnalysis}
              loading={loadingDetails}
              pendingMessage={analysisState.thinking ? "Производится анализ транскрипции. Результат появится после завершения обработки." : undefined}
              onEvidenceActivate={openEvidence}
              speakerAssignments={speakerAssignments}
            />
          </InfoCard>
          {analysis && isAnalysisDone(analysis) && reviewContext && <AnalysisComments callId={call.id} analysisId={analysis.id} comments={reviewContext.comments ?? []} canComment={reviewContext.capabilities.can_comment_analysis} onChange={(comments)=>setReviewContext((current)=>current?{...current,comments}:current)} />}
        </div>
      </div>
      <div className="next-step">
        <span className="step-icon">
          <WandSparkles size={19} />
        </span>
        <div>
          <h3>Следующий шаг</h3>
          <p>{analysisNextStep(displayedAnalysis)}</p>
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
      {challengeOpen && createPortal(<div className="quality-challenge-backdrop" role="presentation" onMouseDown={() => !qualityReviewBusy && setChallengeOpen(false)}><section className="quality-challenge-dialog" role="dialog" aria-modal="true" aria-labelledby="quality-challenge-title" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Пересмотр анализа</span><h2 id="quality-challenge-title">Что вас не устроило?</h2><p>Опишите, с какими выводами, оценками или формулировками ИИ вы не согласны. Сообщение увидит специалист по проверке качества.</p><label><span>Сопроводительное сообщение</span><textarea autoFocus maxLength={5000} value={challengeReason} placeholder="Например: в анализе неверно указано, что я не уточнил следующий шаг…" onChange={(event) => setChallengeReason(event.target.value)} /><small>{challengeReason.trim().length}/5000 · минимум 10 символов</small></label><div className="quality-challenge-dialog-actions"><button className="ghost-button" type="button" disabled={qualityReviewBusy} onClick={() => setChallengeOpen(false)}>Отмена</button><button className="primary-button" type="button" disabled={qualityReviewBusy || challengeReason.trim().length < 10} onClick={() => void challengeAnalysis()}>{qualityReviewBusy ? "Отправляю…" : "Отправить на пересмотр"}</button></div></section></div>, document.body)}
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

function applyEffectiveAnalysis(analysis: AnalysisResponse | undefined, effective: EffectiveAnalysis | undefined): AnalysisResponse | undefined {
  if (!analysis || !effective || !analysis.result_json || typeof analysis.result_json !== "object" || Array.isArray(analysis.result_json)) return analysis;
  const source = analysis.result_json as Record<string, unknown>;
  const criteriaByKey = new Map(effective.criteria.map((item) => [item.criterion_key, item]));
  const criteria = Array.isArray(source.criteria_results)
    ? source.criteria_results.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const item = value as Record<string, unknown>;
      const key = typeof item.code === "string" ? item.code : "";
      const replacement = criteriaByKey.get(key);
      if (!replacement) return value;
      const max = replacement.score_max && replacement.score_max > 0 ? replacement.score_max : 100;
      const normalized = replacement.effective_score === undefined ? undefined : replacement.effective_score / max * 100;
      return {
        ...item,
        status: replacement.not_applicable ? "not_applicable" : item.status,
        points_awarded: replacement.effective_score,
        points_max: replacement.score_max,
        score: normalized,
        effective_source: replacement.effective_source
      };
    })
    : source.criteria_results;
  return {
    ...analysis,
    result_json: {
      ...source,
      score: effective.total_score,
      score_scale: 100,
      effective_source: effective.source,
      criteria_results: criteria
    }
  };
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
