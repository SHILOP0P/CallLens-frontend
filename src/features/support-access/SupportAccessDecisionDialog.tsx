import { CheckCircle2, Clock3, Eye, ShieldAlert, Wrench, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type { SupportAccessGrant, SupportAccessRequest } from "../../types";
import { useEscapeDismiss } from "../../shared/ui/dismissible-layer";

const resourceLabels: Record<string,string> = { calls:"Звонки и их состояние", actions:"Действия по звонкам", integrations:"Настройки интеграций", billing_summary:"Сводка использования тарифа" };
const commandLabels: Record<string,string> = { diagnose:"Диагностика без изменений", retry_ingest:"Повторить импорт звонка", reconnect_integration:"Переподключить интеграцию" };

export function SupportAccessDecisionDialog({requestId,currentUserId,onClose}:{requestId:string;currentUserId:string;onClose:()=>void}){
	const [request,setRequest]=useState<SupportAccessRequest>();
	const [grant,setGrant]=useState<SupportAccessGrant>();
	const [comment,setComment]=useState("");
	const [busy,setBusy]=useState(false);
	const [error,setError]=useState("");
	useEscapeDismiss(!busy,onClose);
	useEffect(()=>{let cancelled=false;api.getSupportAccessRequest(requestId).then((value)=>{if(!cancelled)setRequest(value)}).catch((cause)=>{if(!cancelled)setError(cause instanceof Error?cause.message:"Не удалось загрузить запрос")});return()=>{cancelled=true}},[requestId]);
	async function decide(approve:boolean){if(!request||busy)return;if(!approve&&comment.trim().length<3){setError("Для отказа укажите причину не короче 3 символов");return}setBusy(true);setError("");try{if(approve){const value=await api.approveSupportAccessRequest(request.request_uuid,request.lock_version,comment.trim());setGrant(value);setRequest({...request,status:"approved",lock_version:request.lock_version+1,decision_comment:comment.trim()||null,decided_at:new Date().toISOString()})}else{await api.denySupportAccessRequest(request.request_uuid,request.lock_version,comment.trim());setRequest({...request,status:"denied",lock_version:request.lock_version+1,decision_comment:comment.trim(),decided_at:new Date().toISOString()})}}catch(cause){setError(cause instanceof Error?cause.message:"Не удалось сохранить решение")}finally{setBusy(false)}}
	const canDecide=request?.status==="pending"&&request.approver_user_uuid===currentUserId&&new Date(request.expires_at).getTime()>Date.now();
	return <div className="support-access-layer" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="support-access-dialog glass" role="dialog" aria-modal="true" aria-labelledby="support-access-title">
		<header><span className="support-access-admin-mark" title="Запрос администратора VerbaTrace"><ShieldAlert size={23}/></span><div><span className="eyebrow">ЗАПРОС АДМИНИСТРАТОРА</span><h2 id="support-access-title">Временный доступ поддержки</h2></div><button className="icon-button" type="button" aria-label="Закрыть" onClick={onClose}><X size={18}/></button></header>
		{!request&&!error?<p className="support-access-loading">Загружаю параметры запроса…</p>:null}
		{request?<><p className="support-access-explanation">Администратор VerbaTrace просит разрешение временно открыть только перечисленные ниже данные для решения вашей проблемы. Без вашего подтверждения доступа не будет.</p><blockquote><strong>Причина обращения</strong><p>{request.reason}</p></blockquote><div className="support-access-scope"><section><h3><Eye size={17}/>Что можно просматривать</h3><ul>{request.requested_resources.map((resource)=><li key={resource}>{resourceLabels[resource]??resource}</li>)}</ul></section><section><h3><Wrench size={17}/>Какие действия разрешены</h3>{request.requested_commands.length?<ul>{request.requested_commands.map((command)=><li key={command}>{commandLabels[command]??command}</li>)}</ul>:<p>Изменения не разрешены.</p>}</section></div><div className="support-access-time"><Clock3 size={18}/><span><strong>{formatDuration(request.requested_duration_minutes)}</strong><small>Доступ автоматически закончится по истечении этого времени. Все обращения к данным записываются в журнал.</small></span></div>{request.status!=="pending"?<div className={`support-access-decision support-access-decision-${request.status}`}>{request.status==="approved"?<CheckCircle2 size={20}/>:<XCircle size={20}/>}<span><strong>{request.status==="approved"?"Доступ разрешён":"Доступ не предоставлен"}</strong><small>{grant?`Действует до ${formatDateTime(grant.expires_at)}`:request.decision_comment||"Решение уже принято."}</small></span></div>:null}{canDecide?<div className="support-access-controls"><label>Комментарий к решению<textarea value={comment} maxLength={1000} onChange={(event)=>setComment(event.target.value)} placeholder="Необязательно при подтверждении, обязательно при отказе"/></label><div><button className="ghost-button danger" type="button" disabled={busy||comment.trim().length<3} onClick={()=>void decide(false)}><XCircle size={17}/>Отказать</button><button className="primary-button" type="button" disabled={busy} onClick={()=>void decide(true)}><CheckCircle2 size={17}/>{busy?"Сохраняю…":"Разрешить доступ"}</button></div></div>:null}</>:null}
		{error?<div className="form-error" role="alert">{error}</div>:null}
	</section></div>
}

function formatDuration(minutes:number){if(minutes<60)return`${minutes} мин.`;if(minutes%60===0)return`${minutes/60} ч.`;return`${Math.floor(minutes/60)} ч. ${minutes%60} мин.`}
function formatDateTime(value:string){return new Intl.DateTimeFormat("ru-RU",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
