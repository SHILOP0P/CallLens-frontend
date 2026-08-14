import { Check, MessageSquareText, Pencil, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../api";
import type { AnalysisComment } from "../../types";
import { formatDate } from "../../shared/lib/formatters";

type Props = { callId: string; analysisId: string; comments: AnalysisComment[]; canComment: boolean; onChange: (comments: AnalysisComment[]) => void };

export function AnalysisComments({ callId, analysisId, comments, canComment, onChange }: Props) {
  const [body,setBody] = useState("");
  const [editing,setEditing] = useState<string>();
  const [editBody,setEditBody] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  async function create() {
    const value=body.trim(); if (!value || busy) return;
    setBusy(true); setError("");
    try { const item=await api.createAnalysisComment(callId,analysisId,value); onChange([...comments,item]); setBody(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось опубликовать комментарий"); }
    finally { setBusy(false); }
  }
  async function save(item: AnalysisComment) {
    const value=editBody.trim(); if (!value || busy) return;
    setBusy(true); setError("");
    try { const updated=await api.updateAnalysisComment(item.comment_uuid,item.lock_version,value); onChange(comments.map((entry)=>entry.comment_uuid===updated.comment_uuid?updated:entry)); setEditing(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось изменить комментарий"); }
    finally { setBusy(false); }
  }
  return <section className="analysis-comments" aria-labelledby="analysis-comments-title">
    <header><span><MessageSquareText size={20}/><span><strong id="analysis-comments-title">Обсуждение анализа</strong><small>Комментарии не изменяют официальную оценку</small></span></span><b>{comments.length}</b></header>
    {comments.length>0 ? <div className="analysis-comments-list">{comments.map((item)=><article key={item.comment_uuid}>
      <div className="analysis-comment-head"><span><strong>{item.author_name}</strong><small>{formatDate(item.created_at)}{item.edited_at ? ` · изменено ${formatDate(item.edited_at)}` : ""}</small></span>{item.can_edit && editing!==item.comment_uuid && <button className="icon-button" type="button" aria-label="Изменить свой комментарий" onClick={()=>{setEditing(item.comment_uuid);setEditBody(item.body);setError("");}}><Pencil size={16}/></button>}</div>
      {editing===item.comment_uuid ? <div className="analysis-comment-editor"><textarea autoFocus maxLength={4000} value={editBody} onChange={(e)=>setEditBody(e.target.value)}/><div><small>{editBody.length}/4000</small><button className="icon-button" type="button" aria-label="Отменить редактирование" onClick={()=>setEditing(undefined)}><X size={17}/></button><button className="primary-button small" type="button" disabled={busy||!editBody.trim()} onClick={()=>void save(item)}><Check size={16}/>Сохранить</button></div></div> : <p>{item.body}</p>}
    </article>)}</div> : <p className="analysis-comments-empty">Комментариев пока нет.</p>}
    {canComment && <div className="analysis-comment-composer"><textarea maxLength={4000} value={body} placeholder="Оставьте комментарий к анализу…" onChange={(e)=>setBody(e.target.value)}/><div><small>{body.length}/4000</small><button className="primary-button" type="button" disabled={busy||!body.trim()} onClick={()=>void create()}>{busy?"Сохраняю…":"Опубликовать"}</button></div></div>}
    {error && <div className="form-error is-dismissible" role="alert">{error}</div>}
  </section>;
}
