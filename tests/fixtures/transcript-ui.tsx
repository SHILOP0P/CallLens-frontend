import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { InfoCard, TranscriptPreview } from "../../src/shared/ui/call";
import { TranscriptCollapseIsland } from "../../src/features/calls/TranscriptCollapseIsland";
import type { TranscriptionResponse } from "../../src/types";
import "../../src/styles/index.css";

const sentence = "Здравствуйте, портал Квестов. Квест Баттл. Меня зовут [ИМЯ]. Я могу вам чем-то помочь? [НОМЕР_ВОДИТЕЛЬСКОГО_УДОСТОВЕРЕНИЯ], [ТЕЛЕФОН]!";
const transcription: TranscriptionResponse = {
  id: "fixture", call_uuid: "fixture", status: "transcribed", provider: "fixture", created_at: "", updated_at: "",
  words: Array.from({ length: 50 }, () => sentence.split(" ")).flat().map((text, index) => ({
    text, start_seconds: index, end_seconds: index + 1,
    ...(text.startsWith("[") ? { redaction: { span_uuid: String(index), entity_type: "person_name" as const, label: "Тестовый маркер", marker: text.slice(0, text.indexOf("]") + 1) } } : {}),
  })),
};

function Fixture() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [active, setActive] = useState(false);
  return <div className="app-shell" style={{ padding: 20 }}>
    <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
      <button type="button" onClick={() => { setExpanded(true); setLoaded(true); }}>Раскрыть до замера переполнения</button>
      <button type="button" onClick={() => setShifted(value => !value)}>Сдвинуть карточку</button>
      <button type="button" onClick={() => setActive(value => !value)}>Подсветить маркер</button>
    </div>
    <div className="call-overview" style={{ width: "min(700px, 90vw)", height: "70vh", overflow: "auto", marginLeft: shifted ? "15vw" : 0 }}>
      <InfoCard title="Расшифровка" status="Готово" className="transcript-card" cardRef={cardRef} action={overflow ? (expanded ? "Свернуть расшифровку" : "Раскрыть") : undefined} actionVariant="analysis" expanded={expanded} onAction={() => setExpanded(value => !value)}>
        {expanded && overflow && <TranscriptCollapseIsland cardRef={cardRef} onCollapse={() => setExpanded(false)} />}
        <TranscriptPreview transcription={loaded ? transcription : undefined} loading={!loaded} expanded={expanded} activeWordIndex={active ? 7 : -1} onOverflowChange={setOverflow} />
      </InfoCard>
      <div style={{ height: 1000 }}>Контент после расшифровки</div>
    </div>
  </div>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
