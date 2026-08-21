import { ArrowLeft, Eye, FileText, GitCompareArrows, History, Pencil, Save, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { activeDepartmentLeaderIds, isCompanyManager } from "../../shared/lib/access";
import type { AnalysisInstruction, AnalysisInstructionVersion, AppliedInstruction, CompanyResponse, DepartmentMemberResponse, SessionState } from "../../types";
import { InstructionDocumentViewer } from "./InstructionDocumentViewer";
import { LiveMarkdownEditor } from "./LiveMarkdownEditor";

type Props = { analysisId?: string; versionId?: string; instructionId?: string; session: SessionState; companies: CompanyResponse[]; departmentMembers: DepartmentMemberResponse[]; onBack: () => void; onCompare: (instructionId: string, versionIds: string[]) => void; };

export function InstructionHistoryPage({ analysisId, versionId, instructionId, session, companies, departmentMembers, onBack, onCompare }: Props) {
  const [applied, setApplied] = useState<AppliedInstruction>();
  const [instruction, setInstruction] = useState<AnalysisInstruction>();
  const [versions, setVersions] = useState<AnalysisInstructionVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState(versionId ?? "");
  const [blob, setBlob] = useState<Blob>();
  const [markdown, setMarkdown] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const resolvedInstructionId = instructionId ?? applied?.instruction_id ?? "";
  const selectedVersion = versions.find((item) => item.id === selectedVersionId);
  const filename = selectedVersion?.original_filename ?? applied?.original_filename ?? instruction?.original_filename ?? "instruction.md";
  const isMarkdown = filename.toLowerCase().endsWith(".md");
  const canEdit = useMemo(() => {
    if (!instruction || !instruction.is_active) return false;
    if (instruction.scope === "personal") return instruction.user_uuid === session.user.id;
    const managed = companies.some((company) => company.id === instruction.company_uuid && isCompanyManager(company, session.user.id));
    if (instruction.scope === "company") return managed;
    return managed || Boolean(instruction.department_uuid && activeDepartmentLeaderIds(departmentMembers, session.user.id).has(instruction.department_uuid));
  }, [companies, departmentMembers, instruction, session.user.id]);

  useEffect(() => {
    let cancelled = false; setLoading(true); setError("");
    const request = analysisId && versionId ? api.getAppliedInstruction(analysisId, versionId) : Promise.resolve(undefined);
    request.then((item) => { if (!cancelled && item) { setApplied(item); setMarkdown(item.content ?? ""); setDraft(item.content ?? ""); } }).catch(() => { if (!cancelled) setError("Инструкция недоступна или у вас нет доступа."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [analysisId, versionId]);

  useEffect(() => {
    if (!resolvedInstructionId) return;
    let cancelled = false;
    Promise.all([api.getInstruction(resolvedInstructionId), api.listInstructionVersions(resolvedInstructionId)]).then(([current, history]) => {
      if (cancelled) return; setInstruction(current); setVersions(history.items); setSelectedVersionId((value) => value || history.items[0]?.id || "");
    }).catch(() => { if (!applied && !cancelled) setError("Инструкция не найдена."); });
    return () => { cancelled = true; };
  }, [applied, resolvedInstructionId]);

  useEffect(() => {
    if (!resolvedInstructionId || !selectedVersionId) return;
    let cancelled = false;
    api.getInstructionVersionFile(resolvedInstructionId, selectedVersionId).then(async (file) => {
      if (cancelled) return; setBlob(file);
      if ((selectedVersion?.original_filename ?? "").toLowerCase().endsWith(".md")) { const text = await file.text(); if (!cancelled) { setMarkdown(text); setDraft(text); } }
    }).catch(() => { if (!applied && !cancelled) setError("Файл версии недоступен."); });
    return () => { cancelled = true; };
  }, [applied, resolvedInstructionId, selectedVersion?.original_filename, selectedVersionId]);

  async function saveMarkdown() {
    if (!instruction || !draft.trim()) return; setBusy(true); setError("");
    try { const file = new File([draft], instruction.original_filename.toLowerCase().endsWith(".md") ? instruction.original_filename : `${instruction.title}.md`, { type: "text/markdown;charset=utf-8" }); const updated = await api.replaceInstructionFile(instruction.id, file); const history = await api.listInstructionVersions(instruction.id); setInstruction(updated); setVersions(history.items); setSelectedVersionId(history.items[0]?.id ?? ""); setMarkdown(draft); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить инструкцию."); } finally { setBusy(false); }
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  }

  function openComparison() {
    if (compareIds.length < 2 || !resolvedInstructionId) return;
    const versionInstructionId = versions.find((item) => compareIds.includes(item.id))?.instruction_id;
    onCompare(versionInstructionId || resolvedInstructionId, compareIds);
  }

  if (loading) return <section className="instruction-history-page atmospheric-page"><div className="instruction-history-shell glass"><div className="instruction-history-loading" /></div></section>;
  return <section className="instruction-history-page atmospheric-page"><button className="ghost-button instruction-history-back" type="button" onClick={onBack}><ArrowLeft size={18} />Назад</button><article className="instruction-history-shell glass">
    <header className="instruction-history-header"><div className="instruction-history-icon"><FileText size={24} /></div><div><span className="eyebrow">ИНСТРУКЦИЯ</span><h1>{filename}</h1><p>{applied ? "Версия, которая фактически применялась при анализе звонка." : "Просмотр, редактирование и история документа."}</p></div>{canEdit ? <button className="ghost-button small" type="button" onClick={() => setEditing(true)}><Pencil size={16}/>Редактировать</button> : <span className="instruction-history-state">Только чтение</span>}</header>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <dl className="instruction-history-meta"><div><dt><History size={16}/>Версия</dt><dd>{selectedVersion ? `Версия ${selectedVersion.version}` : applied ? `Версия ${applied.version}` : "Текущая"}</dd></div><div><dt><FileText size={16}/>Формат</dt><dd>{filename.split(".").pop()?.toUpperCase() ?? "MD"}</dd></div></dl>
    {editing && isMarkdown
      ? <section className="instruction-editor"><header><div><h2>Редактирование Markdown</h2><small>Выберите строку, чтобы увидеть и изменить её Markdown-разметку.</small></div><div><button className="ghost-button small" type="button" onClick={() => { setEditing(false); setDraft(markdown); }}><X size={15}/>Отмена</button><button className="primary-button small" type="button" disabled={busy || !draft.trim()} onClick={() => void saveMarkdown()}><Save size={15}/>{busy ? "Сохраняю…" : "Сохранить версию"}</button></div></header><LiveMarkdownEditor value={draft} onChange={setDraft}/></section>
      : <InstructionDocumentViewer filename={filename} blob={blob} markdown={markdown}/>}
    {canEdit && !isMarkdown ? <label className="ghost-button instruction-version-upload"><Upload size={16}/>Загрузить новую версию<input type="file" hidden accept=".pdf,.docx,.xlsx" onChange={async (event) => { const file=event.target.files?.[0]; if(!file||!instruction)return; setBusy(true); try{await api.replaceInstructionFile(instruction.id,file); const history=await api.listInstructionVersions(instruction.id); setVersions(history.items);setSelectedVersionId(history.items[0]?.id??"");}finally{setBusy(false);} }}/></label> : null}
    {versions.length > 0 ? <section className="instruction-versions"><header><div><History size={19}/><span><h2>История версий</h2><small>Нажмите на карточку, чтобы отметить версию для сравнения</small></span></div><div className="instruction-version-actions"><span><GitCompareArrows size={16}/>Выбрано: {compareIds.length}</span><button className="primary-button small" type="button" disabled={compareIds.length < 2} onClick={openComparison}><GitCompareArrows size={16}/>Сравнить версии</button></div></header><div className="instruction-version-list">{versions.map((item)=>{const checked=compareIds.includes(item.id),disabled=!checked&&compareIds.length>=5;return <div className={`${item.id===selectedVersionId?"active ":""}${checked?"checked":""}`} role="checkbox" aria-checked={checked} aria-disabled={disabled} tabIndex={disabled?-1:0} onClick={()=>{if(!disabled)toggleCompare(item.id)}} onKeyDown={(event)=>{if(!disabled&&(event.key===" "||event.key==="Enter")){event.preventDefault();toggleCompare(item.id)}}} key={item.id}><div className="instruction-version-summary"><strong>Версия {item.version}</strong><small>{new Date(item.created_at).toLocaleString("ru-RU")} · {item.original_filename}</small></div><button className="instruction-version-open" type="button" onClick={(event)=>{event.stopPropagation();setSelectedVersionId(item.id);setEditing(false)}}><Eye size={15}/>Открыть</button><span className={`instruction-version-check${checked?" is-checked":""}`} aria-hidden="true"><span/></span></div>})}</div></section> : null}
  </article></section>;
}
