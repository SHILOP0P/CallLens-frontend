import { Profiler, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CreditActivityChart } from "../../src/features/tariffs/CreditActivityChart";
import { CreditLimitRing } from "../../src/features/tariffs/CreditLimitRing";
import "../../src/styles/index.css";

const varied = Array.from({ length: 160 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 3, 1) + index * 86400000).toISOString().slice(0, 10),
  credits: index % 4 === 0 ? 0 : [5000, 15000, 30000, 50000, 80000, 100000][index % 6],
}));
function Fixture() {
  const [source, setSource] = useState(varied);
  const [percent, setPercent] = useState(100);
  const [ringKey, setRingKey] = useState(0);
  const commits = useRef(0);
  const counterRef = useRef<HTMLOutputElement>(null);
  useLayoutEffect(() => {
    if (counterRef.current) counterRef.current.textContent = String(commits.current);
  }, [percent, ringKey]);
  return <div className="app-shell" style={{ minHeight: "100vh", padding: 30, boxSizing: "border-box" }}>
    <section className="credit-usage-panel glass" style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "auto" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 25 }}>
        <button onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; }}>Сменить тему</button>
        <button onClick={() => setSource([{ date: "2026-09-02", credits: 5000 }])}>Только вчера</button>
        <button onClick={() => setSource(varied)}>Разный расход</button>
        <button onClick={() => setSource([])}>Нет расхода</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Profiler id="credit-ring" onRender={() => { commits.current++; if (counterRef.current) counterRef.current.textContent = String(commits.current); }}>
          <CreditLimitRing key={ringKey} percent={percent} />
        </Profiler>
        <button onClick={() => setRingKey(value => value + 1)}>Повторить анимацию</button>
        <button onClick={() => setPercent(25)}>25%</button>
        <button onClick={() => setPercent(0)}>0%</button>
        <button onClick={() => setPercent(100)}>100%</button>
        <label>React-коммиты области кольца: <output ref={counterRef} aria-label="React-коммиты области кольца">0</output></label>
      </div>
      <CreditActivityChart activity={source} today="2026-09-03" />
    </section>
  </div>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
