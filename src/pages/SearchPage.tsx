import { useMemo, useState } from "react";
import { REGION_DEFS, JOINTS, findJoints, searchRegions } from "../anatomy/atlas";
import { searchStructures } from "../anatomy/pack";
import { navigate, useSettings } from "../core/store";
import { useFilteredTutorials, TutorialGrid } from "../ui/TutorialList";

export default function SearchPage() {
  const settings = useSettings();
  const [q, setQ] = useState("");
  const items = useFilteredTutorials({ query: q });
  const query = q.trim();

  const regions = useMemo(() => (query ? searchRegions(query) : REGION_DEFS.slice(0, 4)), [query]);
  const joints = useMemo(() => (query ? findJoints(query) : JOINTS.slice(0, 4)), [query]);
  const structures = useMemo(() => (query ? searchStructures(query, 8) : []), [query]);

  return (
    <main className="page stack">
      <div>
        <h1>搜索</h1>
        <p className="muted">
          覆盖教程、部位、关节与解剖结构。可直接输入症状，例如「抬不起胳膊」「下巴掉下来」。
        </p>
      </div>

      <div className="search-box">
        <span aria-hidden>⌕</span>
        <input
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          placeholder="症状 / 关节 / 骨骼名称…"
        />
        {query && (
          <button className="btn btn-ghost btn-sm" onClick={() => setQ("")}>
            清空
          </button>
        )}
      </div>

      {regions.length > 0 && (
        <section className="stack">
          <h3>部位</h3>
          <div className="row">
            {regions.map((r) => (
              <button
                key={r.id}
                className="chip"
                onClick={() => navigate(`/tutorials?region=${r.id}`)}
                title={r.injuries.join("、")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {joints.length > 0 && (
        <section className="stack">
          <h3>关节</h3>
          <div className="row">
            {joints.map((j) => (
              <button
                key={j.id}
                className={`chip${j.level === "public" ? "" : " chip-warn"}`}
                onClick={() => navigate(`/atlas?joint=${j.id}`)}
                title={j.injuries.join("、")}
              >
                {j.label}
                <span className="faint">{j.level === "public" ? "大众级" : "专业级"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {structures.length > 0 && (
        <section className="stack">
          <h3>解剖结构</h3>
          <div className="skeleton-list" style={{ maxHeight: 220 }}>
            {structures.map((s) => (
              <button
                key={s.id}
                className="skeleton-item"
                onClick={() => navigate(`/atlas?struct=${s.id.replace("somakine:structure:", "")}`)}
              >
                <span>{s.label}</span>
                <span className="faint">{s.type}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h3>
          教程 <span className="faint">（{items.length}）</span>
        </h3>
        <TutorialGrid items={items} />
      </section>

      {settings.mode === "public" && (
        <div className="notice">部分专业级教程已隐藏，可在设置中切换内容分级。</div>
      )}
    </main>
  );
}
