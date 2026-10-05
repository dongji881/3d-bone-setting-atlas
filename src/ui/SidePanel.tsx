import { useState } from "react";
import type { StructureType } from "@somakine/core";
import { LAYERS, searchStructures } from "../anatomy/pack";
import { countFor } from "../anatomy/selection";
import type { StageSelection } from "../three/AnatomyStage";

export interface PainPoint {
  id: number;
  label: string;
  local: { x: number; y: number; z: number };
}

interface SidePanelProps {
  regionId: string | null;
  types: StructureType[];
  onToggleType: (type: StructureType, on: boolean) => void;
  selection: StageSelection | null;
  onPick: (shortId: string) => void;
  onClearSelection: () => void;
  extra?: React.ReactNode;
  pains?: PainPoint[];
  onRemovePain?: (id: number) => void;
}

export default function SidePanel({
  regionId,
  types,
  onToggleType,
  selection,
  onPick,
  onClearSelection,
  extra,
  pains,
  onRemovePain,
}: SidePanelProps) {
  const [q, setQ] = useState("");
  const results = q.trim() ? searchStructures(q.trim(), 24) : [];

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <span>解剖分层</span>
          <span className="faint">{regionId ?? "全身"}</span>
        </div>
        <div className="panel-body">
          {LAYERS.map((l) => {
            const on = types.includes(l.type);
            const count = countFor(regionId, l.type);
            return (
              <div className={`layer-row${on ? "" : " off"}`} key={l.type}>
                <span className="layer-swatch" style={{ background: l.color }} />
                <span className="layer-name">
                  {l.name}
                  <span className="faint" style={{ display: "block", fontSize: "0.8em" }}>
                    {l.desc}
                  </span>
                </span>
                <span className="layer-count">{count}</span>
                <button
                  className={`switch${on ? " on" : ""}`}
                  aria-label={`切换${l.name}`}
                  disabled={count === 0 && l.type !== "skin"}
                  onClick={() => onToggleType(l.type, !on)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span>选中结构</span>
          {selection && (
            <button className="btn btn-ghost btn-sm" onClick={onClearSelection}>
              清除
            </button>
          )}
        </div>
        <div className="panel-body">
          {selection ? (
            <>
              <div className="row">
                <span className="chip">{selection.type}</span>
                {selection.side !== "none" && <span className="chip">{selection.side}</span>}
              </div>
              <h3>{selection.label}</h3>
              <p className="mono faint">{selection.structureId}</p>
            </>
          ) : (
            <p className="faint">点击 3D 模型查看结构名称与所属分层。</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">结构检索</div>
        <div className="panel-body">
          <div className="search-box">
            <span aria-hidden>⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索骨骼 / 肌肉 / 韧带…"
            />
          </div>
          <div className="skeleton-list">
            {results.map((r) => (
              <button
                key={r.id}
                className={`skeleton-item${selection?.structureId === r.id ? " on" : ""}`}
                onClick={() => onPick(r.id.replace("somakine:structure:", ""))}
              >
                <span>{r.label}</span>
                <span className="faint">{r.type}</span>
              </button>
            ))}
            {!results.length && <p className="faint">输入关键词开始检索。</p>}
          </div>
        </div>
      </section>

      {pains && pains.length > 0 && (
        <section className="panel">
          <div className="panel-head">疼痛点标注</div>
          <div className="panel-body">
            {pains.map((p) => (
              <div className="layer-row" key={p.id}>
                <span
                  className="layer-swatch"
                  style={{ background: "var(--danger)", borderRadius: "50%" }}
                />
                <span className="layer-name">{p.label}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onRemovePain?.(p.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {extra}
    </div>
  );
}
