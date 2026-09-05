import { createRoot } from "react-dom/client";
import { MiniSparkline } from "../../src/features/overview/OverviewPage";
import "../../src/styles/index.css";

const points = [10, 12, 8, 16, 45, 22, 18].map((value, index) => ({ label: `День ${index + 1}`, value, display: String(value) }));
function Fixture() {
  return <main className="app-shell" style={{ minHeight: "100vh", padding: 25 }}>
    <button style={{ position: "relative", zIndex: 1 }} onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; }}>Сменить тему</button>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 25, marginTop: 25 }}>
      {([200, 350, 550] as const).map((width, index) => <article className="dashboard-kpi-card glass-panel" style={{ width, maxWidth: "calc(100vw - 50px)", height: 180, boxSizing: "border-box" }} key={width}>
        <strong>Ширина {width}</strong><MiniSparkline points={points} tone={(["accent", "success", "warning"] as const)[index]} />
      </article>)}
      <article className="dashboard-kpi-card glass-panel" style={{ width: 300, height: 180 }}><strong>Одна точка</strong><MiniSparkline points={[points[0]]} tone="accent" /></article>
    </div>
  </main>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
