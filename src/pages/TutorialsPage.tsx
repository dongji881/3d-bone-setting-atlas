import { useState } from "react";
import { REGION_DEFS } from "../anatomy/atlas";
import { TutorialGrid, useFilteredTutorials } from "../ui/TutorialList";
import { useSettings, setSettings } from "../core/store";

export default function TutorialsPage({ initialRegion }: { initialRegion?: string | null }) {
  const settings = useSettings();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(initialRegion ?? null);
  const items = useFilteredTutorials({ query: q, regionId: region });

  return (
    <main className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>教程库</h1>
          <p className="muted">
            按部位组织的关节复位教学，每套教程包含六段标准结构与可分步播放的 3D 演示。
          </p>
        </div>
        <div className="seg" style={{ minWidth: 240 }}>
          <button
            className={settings.mode === "public" ? "on" : ""}
            onClick={() => setSettings({ mode: "public" })}
          >
            大众模式
          </button>
          <button
            className={settings.mode === "pro" ? "on" : ""}
            onClick={() => setSettings({ mode: "pro" })}
          >
            专业模式
          </button>
        </div>
      </div>

      <div className="search-box">
        <span aria-hidden>⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索关节、部位、症状，如「肩膀脱臼」「手指」「牵拉肘」…"
        />
      </div>

      <div className="row">
        <button className={`chip${region === null ? " chip-public" : ""}`} onClick={() => setRegion(null)}>
          全部部位
        </button>
        {REGION_DEFS.map((r) => (
          <button
            key={r.id}
            className={`chip${region === r.id ? " chip-public" : ""}`}
            onClick={() => setRegion(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {settings.mode === "public" && (
        <div className="notice">
          当前为<b>大众模式</b>：仅显示手指、颞下颌等低风险小关节教程。肩、肘、髋、脊柱等高风险手法需要在「设置」中切换到
          <b>专业模式</b>，并完成相应风险确认。
        </div>
      )}

      <TutorialGrid items={items} />
    </main>
  );
}
