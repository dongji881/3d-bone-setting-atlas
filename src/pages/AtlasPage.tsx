import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { StructureType } from "@somakine/core";
import { JOINTS, REGION_DEFS, regionDefById } from "../anatomy/atlas";
import { idsFor } from "../anatomy/selection";
import { labelOf, LAYERS } from "../anatomy/pack";
import { POSES, type PoseId } from "../three/bodyRig";
import type { AnatomyStage, StageSelection } from "../three/AnatomyStage";
import { StageFrame, useAnatomyStage } from "../ui/Stage";
import SidePanel, { type PainPoint } from "../ui/SidePanel";
import { toast } from "../core/store";

interface PainMarker extends PainPoint {
  el?: HTMLButtonElement | null;
}

export default function AtlasPage({
  joint,
  struct,
  query,
}: {
  joint?: string | null;
  struct?: string | null;
  query?: URLSearchParams;
}) {
  const [types, setTypes] = useState<StructureType[]>(() => {
    const q = query?.get("types")?.trim();
    if (!q) return ["bone", "ligament"];
    const valid = q.split(",").map((t) => t.trim()).filter((t) => LAYERS.some((l) => l.type === t)) as StructureType[];
    return valid.length ? valid : ["bone", "ligament"];
  });
  const [region, setRegion] = useState<string | null>(
    () => (query?.get("region")?.trim() as string | null) ?? null,
  );
  const [pose, setPose] = useState<PoseId>(() => {
    const q = query?.get("pose")?.trim() as PoseId | null;
    return q && POSES.some((p) => p.id === q) ? q : "standing";
  });
  const [yaw, setYaw] = useState(0);
  const [selection, setSelection] = useState<StageSelection | null>(null);
  const [painMode, setPainMode] = useState(false);
  const [pains, setPains] = useState<PainMarker[]>([]);
  const [busy, setBusy] = useState(false);

  const painsRef = useRef<PainMarker[]>([]);
  painsRef.current = pains;
  const painModeRef = useRef(painMode);
  painModeRef.current = painMode;
  const markerEls = useRef(new Map<number, HTMLButtonElement | null>());
  const currentIds = useRef<string[]>([]);

  const jointDef = useMemo(() => JOINTS.find((j) => j.id === joint) ?? null, [joint]);

  const stageRef = useRef<AnatomyStage | null>(null);

  const onFrame = useCallback(() => {
    const s = stageRef.current;
    if (!s) return;
    for (const p of painsRef.current) {
      const el = markerEls.current.get(p.id);
      if (!el) continue;
      const pt = s.project(new THREE.Vector3(p.local.x, p.local.y, p.local.z));
      if (!pt.visible) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "grid";
      el.style.left = `${pt.x}px`;
      el.style.top = `${pt.y}px`;
    }
  }, []);

  const { ref, boxRef, stage } = useAnatomyStage({
    onSelect: (sel) => setSelection(sel),
    onFrame,
  });
  stageRef.current = stage;

  const show = useCallback(
    async (s: typeof stage, ids: string[]) => {
      if (!s) return;
      setBusy(true);
      currentIds.current = ids;
      try {
        await s.show(ids);
        s.refreshBoxes();
        s.setJointLayerVisible(true);
        if (ids.length) s.fitTo(ids, 1.5);
        else s.resetView();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // 结构集合：区域 × 分层
  useEffect(() => {
    if (!stage) return;
    for (const l of LAYERS) stage.setLayerVisible(l.type, types.includes(l.type));
    const ids = idsFor(region, types);
    void show(stage, ids);
  }, [stage, region, types, show]);

  // 体位
  useEffect(() => {
    if (!stage) return;
    const def = POSES.find((p) => p.id === pose);
    if (def) stage.setPose(def);
    const ids = currentIds.current;
    if (ids.length) stage.fitTo(ids, 1.5);
    if (def?.yaw !== undefined) stage.setYaw(def.yaw, 0);
  }, [stage, pose]);

  // 由搜索页跳转来的结构 / 关节定位
  useEffect(() => {
    if (!stage) return;
    if (struct) {
      stage.select(struct);
      stage.fitTo([struct], 1.2);
    } else if (jointDef) {
      stage.fitTo(jointDef.bones as string[], 2.2);
      toast(`已定位：${jointDef.label}`);
    }
  }, [stage, struct, jointDef]);

  // 疼痛标注：在模型上点击落点
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const handler = (e: PointerEvent) => {
      if (!painModeRef.current) return;
      const s = stageRef.current;
      if (!s) return;
      const hits = s.pick(e.clientX, e.clientY);
      const hit = hits.find((h) => h.structureId) ?? hits[0];
      if (!hit) return;
      const local = s.worldToContent(hit.point);
      setPains((prev) => {
        if (prev.length >= 8) return prev;
        return [
          ...prev,
          {
            id: Date.now() + Math.random(),
            label: hit.structureId ? labelOf(`somakine:structure:${hit.structureId}`) : "体表痛点",
            local: { x: local.x, y: local.y, z: local.z },
          },
        ];
      });
      toast("已添加疼痛点");
    };
    el.addEventListener("pointerup", handler);
    return () => el.removeEventListener("pointerup", handler);
  }, [stage, boxRef]);

  const toggleType = (type: StructureType, on: boolean) =>
    setTypes((prev) => (on ? [...new Set([...prev, type])] : prev.filter((t) => t !== type)));

  return (
    <main className="page-wide" style={{ padding: "clamp(12px,2vw,22px)" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <h2>解剖浏览</h2>
          <p className="faint">
            拖动旋转 · 滚轮缩放 · 点击结构查看名称
            {painMode && " · 疼痛标注模式已开启，点击模型落点"}
          </p>
        </div>
        <div className="row">
          <button className={`tool-btn${painMode ? " on" : ""}`} onClick={() => setPainMode((v) => !v)}>
            疼痛标注
          </button>
          <button
            className="tool-btn"
            onClick={() => {
              setPains([]);
              toast("已清除疼痛点");
            }}
          >
            清除标注
          </button>
        </div>
      </div>

      <div className="viewer-grid">
        <div>
          <StageFrame boxRef={ref} overlays={<>
            <div className="stage-toolbar">
              <div className="tool-group">
                <span className="tool-group-label">体位</span>
                <div className="seg seg-vertical">
                  {POSES.map((p) => (
                    <button key={p.id} className={pose === p.id ? "on" : ""} onClick={() => setPose(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="stage-toolbar-right">
              <button
                className="tool-btn"
                onClick={() => {
                  const ids = currentIds.current;
                  if (ids.length) stage?.fitTo(ids, 1.5);
                  else stage?.resetView();
                  setYaw(0);
                }}
              >
                复位视角
              </button>
              <div className="tool-group" style={{ width: 150 }}>
                <span className="tool-group-label">水平旋转</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={yaw}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setYaw(v);
                    stage?.setYaw((v * Math.PI) / 180, 0);
                  }}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div className="stage-status">
              <span className="stage-badge">
                {region ? regionDefById.get(region)?.label ?? region : "全身"} ·{" "}
                {POSES.find((p) => p.id === pose)?.label ?? pose} ·{" "}
                {types.map((t) => LAYERS.find((l) => l.type === t)?.name).join(" + ") || "无分层"}
              </span>
              <span className="stage-badge">{busy ? "加载模型中…" : "就绪"}</span>
            </div>
            {pains.map((p) => (
              <button
                key={p.id}
                className="pain-marker"
                ref={(el) => {
                  markerEls.current.set(p.id, el);
                }}
                title={`${p.label}（点击删除）`}
                onClick={() => setPains((prev) => prev.filter((x) => x.id !== p.id))}
              >
                ✕
              </button>
            ))}
          </>} />

          <div className="row" style={{ marginTop: 10 }}>
            <button
              className={`chip${region === null ? " chip-public" : ""}`}
              onClick={() => setRegion(null)}
            >
              全身
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
        </div>

        <SidePanel
          regionId={region}
          types={types}
          onToggleType={toggleType}
          selection={selection}
          onPick={(id) => {
            stage?.select(id);
            stage?.fitTo([id], 1.1);
          }}
          onClearSelection={() => stage?.select(null)}
          pains={pains}
          onRemovePain={(id) => setPains((prev) => prev.filter((p) => p.id !== id))}
          extra={
            <section className="panel">
              <div className="panel-head">关节标记</div>
              <div className="panel-body">
                <div className="skeleton-list">
                  {JOINTS.map((j) => (
                    <button
                      key={j.id}
                      className={`skeleton-item${joint === j.id ? " on" : ""}`}
                      onClick={() => {
                        const ids = [...new Set([...(currentIds.current), ...j.bones])];
                        void show(stage, ids);
                        setTimeout(() => stage?.fitTo(j.bones as string[], 2.4), 60);
                      }}
                    >
                      <span>{j.label}</span>
                      <span className="faint">{j.level === "public" ? "大众" : "专业"}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          }
        />
      </div>
    </main>
  );
}
