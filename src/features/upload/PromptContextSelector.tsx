import { Check, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { PromptIndustry, PromptPerspective, PromptTopic } from "../../types";
import { SelectControl } from "../../shared/ui/primitives";

export function PromptContextSelector({ disabled, onChange, title = "Темы анализа", description = "Сначала выберите тип анализа, затем отрасль и нужные темы." }: { disabled: boolean; onChange?: (topics: PromptTopic[]) => void; title?: string; description?: string }) {
  const [industries, setIndustries] = useState<PromptIndustry[]>([]);
  const [perspective, setPerspective] = useState<PromptPerspective>("business");
  const [activeIndustry, setActiveIndustry] = useState("");
  const [topics, setTopics] = useState<PromptTopic[]>([]);
  const [selected, setSelected] = useState<PromptTopic[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { let cancelled = false; void Promise.all([api.listPromptIndustries(), api.getPromptSettings()]).then(([catalog, settings]) => { if (cancelled) return; const initialIndustry = settings.industries[0] ?? catalog[0]; setIndustries(catalog); setPerspective(initialIndustry?.perspective ?? "business"); setActiveIndustry(initialIndustry?.key ?? ""); setSelected(settings.topics); onChange?.(settings.topics); }).catch(() => !cancelled && setMessage("Не удалось загрузить каталог тем.")).finally(() => !cancelled && setLoading(false)); return () => { cancelled = true; }; }, []);
  useEffect(() => { if (!activeIndustry) return; let cancelled = false; api.listPromptTopics(activeIndustry).then((items) => !cancelled && setTopics(items)).catch(() => !cancelled && setTopics([])); return () => { cancelled = true; }; }, [activeIndustry]);
  const filteredIndustries = useMemo(() => industries.filter((industry) => industry.perspective === perspective), [industries, perspective]);
  const activeTopics = useMemo(() => { const needle = filter.trim().toLocaleLowerCase("ru-RU"); return topics.filter((topic) => !needle || topic.title.toLocaleLowerCase("ru-RU").includes(needle)); }, [filter, topics]);
  const selectedKeys = useMemo(() => new Set(selected.map((topic) => topic.key)), [selected]);
  function changePerspective(next: PromptPerspective) { setPerspective(next); setActiveIndustry(industries.find((industry) => industry.perspective === next)?.key ?? ""); setFilter(""); }
  function toggleTopic(topic: PromptTopic) { const next = selectedKeys.has(topic.key) ? selected.filter((item) => item.key !== topic.key) : [...selected, topic]; setSelected(next); onChange?.(next); }
  async function save() { setSaving(true); setMessage(""); try { const industryKeys = [...new Set(selected.map((item) => item.industry_key).concat(activeIndustry ? [activeIndustry] : []))]; const result = await api.savePromptSettings({ description: "", industry_keys: industryKeys, topic_keys: selected.map((item) => item.key) }); setSelected(result.topics); onChange?.(result.topics); setMessage("Настройки тем сохранены."); } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки."); } finally { setSaving(false); } }

  return <section className="prompt-context-card">
    <div className="prompt-context-heading"><Sparkles size={19} /><div><strong>{title}</strong><small>{description}</small></div></div>
    <div className="prompt-context-grid"><label>Тип анализа<SelectControl value={perspective} disabled={disabled || saving || loading} onChange={(event) => changePerspective(event.target.value as PromptPerspective)}><option value="business">Бизнес и работа</option><option value="personal">Личное общение</option></SelectControl></label><label>Отрасль<SelectControl value={activeIndustry} disabled={disabled || saving || loading} onChange={(event) => { setActiveIndustry(event.target.value); setFilter(""); }}><option value="">Выберите отрасль</option>{filteredIndustries.map((industry) => <option key={industry.key} value={industry.key}>{industry.title}</option>)}</SelectControl></label></div>
    <label>Поиск темы<input value={filter} disabled={disabled || saving || loading || !activeIndustry} placeholder="Начните вводить название" onChange={(event) => setFilter(event.target.value)} /></label>
    {activeIndustry && <div className="prompt-topic-section"><strong>Доступные темы</strong><div className="prompt-topic-list" aria-label="Темы выбранной отрасли">{activeTopics.length ? activeTopics.map((topic) => <button type="button" key={topic.key} disabled={disabled || saving} className={selectedKeys.has(topic.key) ? "prompt-topic active" : "prompt-topic"} onClick={() => toggleTopic(topic)}>{selectedKeys.has(topic.key) && <Check size={14} />}{topic.title}</button>) : <small className="muted">Темы не найдены.</small>}</div></div>}
    {selected.length > 0 && <div className="prompt-selected-section"><strong>Выбрано для анализа: {selected.length}</strong><div className="prompt-selected" aria-label="Выбранные темы">{selected.map((topic) => <span key={topic.key}>{topic.title}<button type="button" aria-label={`Убрать ${topic.title}`} disabled={disabled || saving} onClick={() => toggleTopic(topic)}><X size={14} /></button></span>)}</div></div>}
    {message && <small className={message === "Настройки тем сохранены." ? "form-success compact" : "form-error compact"}>{message}</small>}
    <div className="prompt-actions"><button type="button" className="ghost-button small" disabled={disabled || saving || loading} onClick={() => void save()}>{saving ? "Сохраняю..." : "Сохранить как настройки по умолчанию"}</button></div>
  </section>;
}
