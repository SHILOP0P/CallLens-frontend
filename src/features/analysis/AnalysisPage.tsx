import {
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  WandSparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisInstruction,
  AnalysisResponse,
  AppPage,
  CallResponse,
  CallStatus,
  CompanyResponse,
  DepartmentResponse,
  SessionState
} from "../../types";

import { isAnalysisDone } from "../../shared/lib/analysis";
import { statusMeta } from "../../shared/lib/call-status";
import { AnalysisStructuredView } from "../../shared/ui/analysis";
import { StatusTimeline } from "../../shared/ui/call";
import { AnalysisResultSkeleton, CallListSkeleton } from "../../shared/ui/loading";
import { availableInstructionsForCall, contextInstructionCaption, InstructionMiniList } from "../instructions/instruction-components";
import { ReportExportPanel } from "../reports/ReportExportPanel";

export function AnalysisPage({
  session,
  calls,
  selectedCall,
  selectedCallId,
  selectedCallTimeline,
  analyses,
  instructions,
  companies,
  departments,
  loading,
  loadingDetails,
  onSelectCall,
  onAnalysisReady,
  onDeleteCall,
  onNavigate
}: {
  session: SessionState;
  calls: CallResponse[];
  selectedCall?: CallResponse;
  selectedCallId: string;
  selectedCallTimeline?: CallStatus[];
  analyses: Record<string, AnalysisResponse>;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading: boolean;
  loadingDetails: boolean;
  onSelectCall: (callId: string) => void;
  onAnalysisReady: (callId: string, analysis: AnalysisResponse) => void;
  onDeleteCall: (callId: string) => Promise<void>;
  onNavigate: (page: AppPage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const analysis = selectedCall ? analyses[selectedCall.id] : undefined;
  const availableInstructions = selectedCall
    ? availableInstructionsForCall(instructions, selectedCall)
    : [];

  useEffect(() => {
    setShowFullAnalysis(false);
  }, [selectedCall?.id]);

  async function runAnalysis() {
    if (!selectedCall) return;
    setError("");
    setBusy(true);
    try {
      const result = await api.analyzeCall(selectedCall.id);
      onAnalysisReady(selectedCall.id, result);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось запустить анализ");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedCall() {
    if (!selectedCall || deleting) return;

    const confirmed = window.confirm(`Удалить звонок "${selectedCall.title}"? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await onDeleteCall(selectedCall.id);
    } catch (deleteCallError) {
      setDeleteError(deleteCallError instanceof Error ? deleteCallError.message : "Не удалось удалить звонок");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="analysis-layout">
      <aside className="calls-sidebar glass">
        <div className="panel-heading">
          <h2>AI-аналитика</h2>
          <button className="primary-button small" onClick={() => onNavigate("upload")}>
            <Plus size={16} />
            Звонок
          </button>
        </div>
        <div className="call-list compact-list">
          {loading ? (
            <CallListSkeleton compact count={4} />
          ) : (
            calls.map((call) => (
              <button
                key={call.id}
                className={`call-row ${selectedCallId === call.id ? "selected" : ""}`}
                onClick={() => onSelectCall(call.id)}
              >
                <span className="play-dot">
                  <Sparkles size={14} />
                </span>
                <span>
                  <strong>{call.title}</strong>
                  <small>{statusMeta[call.status].chip}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
      <section className="analysis-detail glass">
        <div className="panel-heading large">
          <div>
            <h1>AI-аналитика</h1>
            <p>Качество разговоров, ключевые темы, сигналы по выбранному звонку и рекомендации AI.</p>
          </div>
          <div className="panel-actions">
            <button className="primary-button" onClick={runAnalysis} disabled={!selectedCall || busy}>
              <WandSparkles size={18} />
              {busy ? "Анализирую..." : "Запустить анализ"}
            </button>
            <button className="ghost-button danger-button" onClick={deleteSelectedCall} disabled={!selectedCall || deleting}>
              <Trash2 size={18} />
              {deleting ? "Удаляю..." : "Удалить"}
            </button>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {deleteError && <div className="form-error">{deleteError}</div>}
        {selectedCall && (
          <StatusTimeline current={selectedCall.status} statuses={selectedCallTimeline} />
        )}
        {selectedCall && <ReportExportPanel call={selectedCall} analysis={analysis} />}
        <div className="analysis-content-grid">
          <div className="info-card">
            <div className="card-title">
              <h3>Результат</h3>
              <span className="status-chip ok">{isAnalysisDone(analysis) ? "Готово" : "Нет анализа"}</span>
            </div>
            {loadingDetails || (loading && !selectedCall) ? (
              <AnalysisResultSkeleton />
            ) : !isAnalysisDone(analysis) ? (
              <div className="empty-state compact analysis-result-empty">
                {selectedCall ? "Для этого звонка еще нет готового AI-анализа." : "Выберите звонок, чтобы увидеть результат анализа."}
              </div>
            ) : (
              <div className="analysis-user-summary">
                <div className={`analysis-full-text expandable-content ${showFullAnalysis ? "expanded" : "collapsed"}`}>
                  <AnalysisStructuredView analysis={analysis} />
                </div>
                <button
                  className={`analysis-toggle-button ${showFullAnalysis ? "expanded" : ""}`}
                  type="button"
                  aria-expanded={showFullAnalysis}
                  onClick={() => setShowFullAnalysis((current) => !current)}
                >
                  <span>{showFullAnalysis ? "Свернуть анализ" : "Открыть полный анализ"}</span>
                  <span className="analysis-toggle-icon">
                    <ChevronRight size={18} />
                  </span>
                </button>
              </div>
            )}
          </div>
          <div className="info-card">
            <div className="card-title">
              <h3>Инструкции для этого звонка</h3>
              <span className="status-chip ok">{contextInstructionCaption(selectedCall)}</span>
            </div>
            <InstructionMiniList
              instructions={availableInstructions}
              companies={companies}
              departments={departments}
            />
          </div>
        </div>
      </section>
    </section>
  );
}
