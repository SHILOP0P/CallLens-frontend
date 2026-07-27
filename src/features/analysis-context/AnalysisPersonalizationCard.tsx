import { Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type { AnalysisPersonalizationScope } from "../../types";

interface AnalysisPersonalizationCardProps {
  scope: AnalysisPersonalizationScope;
  ownerUuid: string;
  companyUuid?: string;
  title: string;
  description: string;
  editable: boolean;
}

export function AnalysisPersonalizationCard({
  scope,
  ownerUuid,
  companyUuid,
  title,
  description,
  editable
}: AnalysisPersonalizationCardProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage("");
    api.getAnalysisPersonalization(scope, ownerUuid, companyUuid)
      .then((item) => {
        if (!cancelled) setContent(item.content);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Не удалось загрузить персонализацию.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyUuid, ownerUuid, scope]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const item = await api.saveAnalysisPersonalization(scope, ownerUuid, content, companyUuid);
      setContent(item.content);
      setMessage("Персонализация сохранена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить персонализацию.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="analysis-personalization-card glass-panel">
      <div className="analysis-personalization-heading">
        <span aria-hidden="true"><Sparkles size={19} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <label>
        Контекст для анализатора
        <textarea
          value={content}
          disabled={loading || saving || !editable}
          maxLength={6000}
          rows={7}
          placeholder="Например: чем вы занимаетесь, какие услуги оказываете, кто ваши клиенты и какие особенности важно учитывать при анализе звонков."
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <div className="analysis-personalization-footer">
        <small>{content.length} / 6000</small>
        {message && <span className={message.includes("сохранена") ? "form-success compact" : "form-error compact"}>{message}</span>}
        {editable && (
          <button className="primary-button small" type="button" disabled={loading || saving} onClick={() => void save()}>
            <Save size={16} />
            {saving ? "Сохраняю…" : "Сохранить"}
          </button>
        )}
      </div>
    </section>
  );
}
