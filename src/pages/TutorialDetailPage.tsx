import { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { StructureType } from "@somakine/core";
import { JOINTS } from "../anatomy/atlas";
import { idsFor } from "../anatomy/selection";
import { labelOf } from "../anatomy/pack";
import { PHASES, type PhaseId, type Step, type Tutorial } from "../content/types";
import { tutorialOf } from "../content/tutorials";
import { videoEmbed } from "../content/video";
import { navigate, toast, toggleFavorite, useSettings } from "../core/store";
import { POSES, type PoseId } from "../three/bodyRig";
import { LevelChip } from "../ui/Chrome";
import { StageFrame, useAnatomyStage } from "../ui/Stage";

const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2]);
const yawOf = (v?: Step["wideView"]) =>
  v === "back" ? Math.PI : v === "side" ? Math.PI / 2 : v === "top" ? 0 : 0;

function useShowIds(tut: Tutorial | null): string[] {
  return useMemo(() => {
    if (!tut) return [];
    const types: StructureType[] = ["bone", "ligament", "tendon"];
    const ids = new Set(idsFor(tut.regionId, types));
    for (const s of tut.steps) for (const b of s.params.siteBones) ids.add(b);
    const joint = JOINTS.find((j) => j.id === tut.jointId);
    if (joint) joint.bones.forEach((b) => ids.add(b));
    ids.add(tut.mobileBone);
    return [...ids];
  }, [tut]);
}

/* ------------------------------------------------------------------ */
/* 正常 / 脱位 分屏对比                                                 */
/* ------------------------------------------------------------------ */

function ComparePane({ tut, dislocated }: { tut: Tutorial; dislocated: boolean }) {
  const ids = useShowIds(tut);
  const { ref, stage } = useAnatomyStage({});
  const joint = JOINTS.find((j) => j.id === tut.jointId);

  useEffect(() => {
    if (!stage) return;
    let dead = false;
    void (async () => {
      await stage.show(ids);
      if (dead) return;
      stage.refreshBoxes();
      const pose = POSES.find((p) => p.id === tut.positions[0]);
      if (pose) stage.setPose(pose);
      stage.refreshBoxes();
      if (dislocated) {
        stage.setTransform(
          tut.mobileBone,
          { offset: v3(tut.dislocation) },
          joint?.side,
        );
        stage.setStructureColor(tut.mobileBone, tut.dislocationColor ?? "#ff5a63");
      } else {
        stage.clearOffsets();
        stage.setStructureColor(tut.mobileBone, null);
      }
      stage.setViewports([{ rect: [0, 0, 1, 1], target: new THREE.Vector3(), distance: 2.4 }]);
      stage.fitTo(ids, 1.5, 0);
      stage.setYaw(Math.PI / 2, 0);
    })();
    return () => {
      dead = true;
    };
  }, [stage, ids, dislocated, tut, joint]);

  return (
    <StageFrame
      boxRef={ref}
      height={340}
      overlays={
        <>
          <div className="stage-toolbar">
            <span className="stage-badge">
              {dislocated ? "脱位状态" : "正常解剖位"}
            </span>
          </div>
          <div className="stage-status">
            <span className="stage-badge">{tut.title}</span>
            <span className="stage-badge">{joint?.label ?? ""}</span>
          </div>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* 主页面                                                              */
/* ------------------------------------------------------------------ */

export default function TutorialDetailPage({ id }: { id: string }) {
  const settings = useSettings();
  const tut = tutorialOf(id) ?? null;
  const [phase, setPhase] = useState<PhaseId>("selfcheck");
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [screened, setScreened] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [pose, setPose] = useState<PoseId>("standing");
  const [compare, setCompare] = useState(false);
  const [camIdx, setCamIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);

  const ids = useShowIds(tut);
  const { ref: boxRef, stage } = useAnatomyStage({ onSelect: (s) => setSelection(s?.structureId ?? null) });

  const step = tut?.steps[Math.min(stepIdx, tut.steps.length - 1)] ?? null;
  const embed = videoEmbed(tut?.videoSrc);

  useEffect(() => {
    if (!tut) return;
    setPhase("selfcheck");
    setStepIdx(0);
    setScreened(false);
    setTicked([]);
    setPose(tut.positions[0]);
    setPlaying(false);
    setCamIdx(0);
    setCompare(false);
  }, [tut]);

  /* 深链 ?step=n 直接跳到第 n 步、?compare=1 打开正常/脱位对比（便于分享 / 回放） */
  useEffect(() => {
    if (!tut) return;
    const raw = `${window.location.search}${window.location.hash}`;
    const m = /[?&]step=(\d+)/.exec(raw);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= tut.steps.length) {
        setPhase("steps");
        setStepIdx(n - 1);
      }
    }
    if (/[?&]compare=1/.test(raw)) setCompare(true);
  }, [tut]);

  /* 加载结构 + 应用体位 */
  useEffect(() => {
    if (!stage || !tut) return;
    let dead = false;
    setReady(false);
    void (async () => {
      await stage.show(ids);
      if (dead) return;
      stage.refreshBoxes();
      stage.setJointLayerVisible(true);
      const def = POSES.find((p) => p.id === pose);
      if (def) stage.setPose(def);
      stage.refreshBoxes();
      if (!dead) setReady(true);
    })();
    return () => {
      dead = true;
    };
  }, [stage, tut, ids, pose]);

  /* 应用当前步骤：变形、箭头、标记、机位 */
  const applyStep = useCallback(
    (s: NonNullable<typeof stage>, t: Tutorial, idx: number) => {
      const st = t.steps[Math.min(idx, t.steps.length - 1)];
      const j = JOINTS.find((x) => x.id === t.jointId);

      const anchor =
        j && s.rawBox(j.bones[0]) && s.rawBox(j.bones[1])
          ? s.jointAnchorOf(j.bones[0], j.bones[1], j.side)
          : null;

      /* 复位进程：从第 0 步累积到当前步，未写 anim 的步骤保持上一步状态 */
      let applied: {
        id: string;
        opts: { offset?: THREE.Vector3; rotation?: THREE.Euler; pivot?: THREE.Vector3 };
        side?: "left" | "right";
      } | null = null;
      for (let i = 0; i <= idx; i++) {
        const a = t.steps[Math.min(i, t.steps.length - 1)].anim;
        if (!a) continue;
        applied = {
          id: a.structure,
          opts: {
            offset: a.offset ? v3(a.offset) : undefined,
            rotation: a.rot ? new THREE.Euler(a.rot[0], a.rot[1], a.rot[2]) : undefined,
            pivot: a.rot && anchor ? anchor : undefined,
          },
          side: j?.side,
        };
      }
      s.animateTransforms(applied ? [applied] : [], 700);

      /* 活动骨仍停在脱位位置时上警示色，复位后恢复本色 */
      const stillDislocated =
        !!applied?.opts.offset && t.dislocation && applied.opts.offset.distanceTo(v3(t.dislocation)) < 1e-4;
      s.setStructureColor(t.mobileBone, stillDislocated ? t.dislocationColor ?? "#ff5a63" : null);

      const jb = j ? (s.sideBox(j.bones[0], j.side) ?? s.rawBox(j.bones[0])) : null;
      const js = jb ? jb.getSize(new THREE.Vector3()).length() : 0.3;
      const markerR = Math.min(0.035, Math.max(0.01, js * 0.12));
      s.setJointMarkers(anchor ? [{ point: anchor.clone(), color: "#2ee6dd", radius: markerR }] : []);

      const space = st.arrowSpace ?? "world";
      const arrows = st.arrows.map((a) => {
        const base = space === "anchor" && anchor ? anchor : new THREE.Vector3();
        return { from: base.clone().add(v3(a.from)), to: base.clone().add(v3(a.to)), color: a.color };
      });
      s.setArrows(arrows);

      /* 机位 */
      const worldAnchor = anchor ? s.contentToWorld(anchor) : new THREE.Vector3(0, 0.9, 0.1);
      if (st.camera === "both") {
        s.setViewports([
          { rect: [0, 0, 0.5, 1], target: new THREE.Vector3(), distance: 2.6 },
          { rect: [0.5, 0, 0.5, 1], target: worldAnchor, distance: 0.34 },
        ]);
        s.fitTo(ids, 1.7, 0);
        s.setYaw(yawOf(st.wideView), 0);
        s.setYaw(Math.PI / 2, 1);
      } else if (st.camera === "joint") {
        s.setViewports([{ rect: [0, 0, 1, 1], target: worldAnchor, distance: 0.34 }]);
        s.setYaw(st.wideView ? yawOf(st.wideView) : Math.PI / 3, 0);
      } else {
        s.setViewports([{ rect: [0, 0, 1, 1], target: new THREE.Vector3(), distance: 2.6 }]);
        s.fitTo(ids, 1.6, 0);
        s.setYaw(yawOf(st.wideView), 0);
      }
    },
    [ids],
  );

  useEffect(() => {
    if (!stage || !tut || !ready) return;
    applyStep(stage, tut, stepIdx);
  }, [stage, tut, ready, stepIdx, applyStep]);

  /* 自动播放 */
  useEffect(() => {
    if (!playing || !tut) return;
    const total = tut.steps.length;
    const timer = window.setInterval(() => {
      setStepIdx((i) => {
        if (i + 1 >= total) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [playing, tut]);

  const blocked = tut ? ticked.length > 0 : false;

  if (!tut) {
    return (
      <main className="page stack">
        <div className="notice notice-danger">未找到该教程。</div>
        <button className="btn" onClick={() => navigate("/tutorials")}>
          返回教程库
        </button>
      </main>
    );
  }

  if (tut.level === "pro" && settings.mode !== "pro") {
    return (
      <main className="page stack">
        <div className="notice notice-danger">
          <b>{tut.title}</b> 属于专业级内容，当前为大众模式。
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate("/settings")}>
            去设置中开启专业模式
          </button>
          <button className="btn btn-ghost" onClick={() => navigate("/tutorials")}>
            返回教程库
          </button>
        </div>
      </main>
    );
  }

  const fav = settings.favorites.includes(tut.id);

  return (
    <main className="page stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/tutorials")}>
              ← 教程库
            </button>
            <LevelChip level={tut.level} />
            <span className="chip">{tut.subtitle}</span>
          </div>
          <h1>{tut.title}</h1>
          <p className="muted" style={{ maxWidth: "78ch", margin: 0 }}>
            {tut.summary}
          </p>
          <div className="tag-list">
            {tut.keywords.map((k) => (
              <span className="chip" key={k}>
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="row">
          <button
            className={`btn${fav ? " btn-primary" : ""}`}
            onClick={() => {
              const on = toggleFavorite(tut.id);
              toast(on ? "已收藏" : "已取消收藏");
            }}
          >
            {fav ? "★ 已收藏" : "☆ 收藏"}
          </button>
          <button className="btn" onClick={() => setCompare((v) => !v)}>
            {compare ? "关闭对比" : "正常 / 脱位对比"}
          </button>
        </div>
      </div>

      {/* ---------- 禁忌症筛查 ---------- */}
      <section className={`panel${blocked ? "" : ""}`}>
        <div className="panel-head">
          <span>第一步 · 禁忌症筛查</span>
          <span className={blocked ? "chip chip-pro" : "chip chip-public"}>
            {blocked ? "存在禁忌，禁止操作" : screened ? "筛查通过" : "未完成"}
          </span>
        </div>
        <div className="panel-body">
          <p className="muted" style={{ margin: 0 }}>
            请逐条核对。只要勾选任意一条，即表示存在禁忌，不得进行本手法，应立即就医。
          </p>
          <div className="check-list">
            {tut.contraindications.map((c) => {
              const on = ticked.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={`check-item${on ? " on" : ""}`}
                  onClick={() =>
                    setTicked((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                  }
                >
                  <span className="check-box">{on ? "✓" : ""}</span>
                  <span>{c.text}</span>
                </div>
              );
            })}
          </div>
          {blocked ? (
            <div className="notice notice-danger">
              已勾选 {ticked.length} 项禁忌。<b>禁止实施复位手法。</b>
              请前往医院由专业医师处理；本工具不能替代诊断与治疗。
            </div>
          ) : (
            <div className="row">
              <button
                className={`btn ${screened ? "" : "btn-primary"}`}
                onClick={() => {
                  setScreened(true);
                  toast("筛查通过");
                }}
              >
                以上均无，确认可继续
              </button>
              {screened && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setScreened(false);
                    setPhase("selfcheck");
                  }}
                >
                  重新筛查
                </button>
              )}
            </div>
          )}
          {!screened && !blocked && (
            <p className="faint">完成筛查后可进入「分步操作」查看 3D 手法演示。</p>
          )}
        </div>
      </section>

      <div className="tut-layout">
        {/* ---------- 左栏：六段 + 步骤 ---------- */}
        <div className="step-rail">
          {PHASES.map((p) => (
            <button
              key={p.id}
              className={`step-item${phase === p.id ? " on" : ""}`}
              onClick={() => {
                if (p.id === "steps" && (blocked || !screened)) {
                  toast(blocked ? "存在禁忌，无法进入分步操作" : "请先完成禁忌症筛查");
                  return;
                }
                setPhase(p.id);
              }}
            >
              <span className="step-idx">{p.icon}</span>
              <span>
                <span className="step-title">{p.label}</span>
                <span className="step-sub">{p.desc}</span>
              </span>
            </button>
          ))}

          {phase === "steps" && (
            <>
              <hr className="divider" />
              {tut.steps.map((s, i) => (
                <button
                  key={s.id}
                  className={`step-item${i === stepIdx ? " on" : ""}${i < stepIdx ? " done" : ""}`}
                  onClick={() => setStepIdx(i)}
                >
                  <span className="step-idx">{i + 1}</span>
                  <span>
                    <span className="step-title">{s.title}</span>
                    <span className="step-sub">{s.summary}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* ---------- 右栏 ---------- */}
        <div className="stack">
          {phase === "selfcheck" && (
            <section className="card stack">
              <h2>损伤自查</h2>
              <p className="muted">符合以下表现时，才考虑本手法的适应范围；有任何一项不符请停止。</p>
              <div className="check-list">
                {tut.selfCheck.map((s, i) => (
                  <div className="check-item" key={i}>
                    <span className="check-box">✓</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="notice">
                自查只用于教学判断，<b>不能替代 X 线 / CT</b>。儿童、老年人、孕妇及有基础骨病者请直接就医。
              </div>
              <div className="row">
                <button className="btn btn-primary" onClick={() => setPhase("prep")}>
                  下一步：术前准备
                </button>
              </div>
            </section>
          )}

          {phase === "prep" && (
            <section className="card stack">
              <h2>术前准备</h2>
              <div className="check-list">
                {tut.prep.map((s, i) => (
                  <div className="check-item" key={i}>
                    <span className="check-box">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="row">
                <button className="btn" onClick={() => setPhase("selfcheck")}>
                  返回自查
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (blocked) return toast("存在禁忌，无法进入分步操作");
                    if (!screened) return toast("请先完成禁忌症筛查");
                    setPhase("steps");
                  }}
                >
                  下一步：分步操作
                </button>
              </div>
            </section>
          )}

          {phase === "steps" && step && (
            <section className="stack">
              {/* 3D 主舞台 */}
              <StageFrame
                boxRef={boxRef}
                overlays={
                  <>
                    <div className="stage-toolbar">
                      <div className="tool-group">
                        <span className="tool-group-label">患者体位</span>
                        <div className="seg seg-vertical">
                          {POSES.filter((p) => tut.positions.includes(p.id)).map((p) => (
                            <button
                              key={p.id}
                              className={pose === p.id ? "on" : ""}
                              onClick={() => setPose(p.id)}
                            >
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
                          applyStep(stage!, tut, stepIdx);
                          toast("已复位机位与视角");
                        }}
                      >
                        复位视角
                      </button>
                      <button
                        className="tool-btn"
                        onClick={() => {
                          stage?.select(null);
                          setSelection(null);
                        }}
                      >
                        取消选中
                      </button>
                    </div>
                    <div className="stage-status">
                      <span className="stage-badge">
                        第 {stepIdx + 1} / {tut.steps.length} 步 · {step.title}
                      </span>
                      <span className="stage-badge">
                        {selection ? labelOf(`somakine:structure:${selection}`) : "点击结构可查看名称"}
                      </span>
                    </div>
                  </>
                }
              />

              {/* 播放控制 */}
              <div className="player-bar">
                <button className="btn btn-sm" onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
                  ‹ 上一步
                </button>
                <button
                  className={`btn btn-sm${playing ? " btn-primary" : ""}`}
                  onClick={() => setPlaying((v) => !v)}
                >
                  {playing ? "⏸ 暂停" : "▶ 自动播放"}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setStepIdx((i) => Math.min(tut.steps.length - 1, i + 1))}
                >
                  下一步 ›
                </button>
                <div
                  className="timeline"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - r.left) / r.width;
                    const idx = Math.min(
                      tut.steps.length - 1,
                      Math.max(0, Math.round(ratio * (tut.steps.length - 1))),
                    );
                    setStepIdx(idx);
                  }}
                >
                  <div
                    className="timeline-fill"
                    style={{
                      width: `${(stepIdx / Math.max(tut.steps.length - 1, 1)) * 100}%`,
                    }}
                  />
                  {tut.steps.map((s, i) => (
                    <span
                      key={s.id}
                      className="timeline-tick"
                      style={{
                        left: `${(i / Math.max(tut.steps.length - 1, 1)) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <span className="faint mono">
                  {stepIdx + 1}/{tut.steps.length}
                </span>
              </div>

              {/* 参数 + 解说 */}
              <section className="card stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>
                    步骤 {stepIdx + 1} · {step.title}
                  </h3>
                  <span className="chip chip-warn">力度 {step.params.force} / 5</span>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {step.narration}
                </p>
                <div className="param-grid">
                  <div className="param">
                    <div className="param-k">按压位置</div>
                    <div className="param-v">{step.params.site}</div>
                  </div>
                  <div className="param">
                    <div className="param-k">发力方向</div>
                    <div className="param-v">{step.params.direction}</div>
                  </div>
                  <div className="param">
                    <div className="param-k">旋转 / 屈伸角度</div>
                    <div className="param-v">{step.params.angle}</div>
                  </div>
                  <div className="param">
                    <div className="param-k">动作节奏</div>
                    <div className="param-v">{step.params.rhythm}</div>
                  </div>
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <div className="param-k">力度等级（1 轻 — 5 重）</div>
                  <div className="force-meter">
                    <i style={{ width: `${step.params.force * 20}%` }} />
                  </div>
                </div>
                <div className="tag-list">
                  {step.params.siteBones.map((b) => (
                    <button
                      key={b}
                      className="chip"
                      onClick={() => {
                        stage?.select(b);
                        stage?.fitTo([b], 1.1, step.camera === "both" ? 1 : 0);
                      }}
                    >
                      {labelOf(`somakine:structure:${b}`)}
                    </button>
                  ))}
                </div>
              </section>

              {/* 教学视频 / 多机位演示 */}
              <section className="card stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>教学视频</h3>
                  <div className="row" style={{ gap: 10 }}>
                    {embed?.kind === "iframe" && (
                      <a
                        className="video-source"
                        href={embed.watchUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        在哔哩哔哩打开 ↗
                      </a>
                    )}
                    <span className="faint">步骤时间点 {step.videoAt ?? 0}s</span>
                  </div>
                </div>
                <div className="video-frame">
                  <div className="camera-tabs">
                    {tut.videoCameras.map((c, i) => (
                      <button
                        key={c.id}
                        className={`tool-btn${i === camIdx ? " on" : ""}`}
                        onClick={() => {
                          setCamIdx(i);
                          if (stage) {
                            stage.setYaw(yawOf(c.view as Step["wideView"]), 0);
                            toast(`机位：${c.label}`);
                          }
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  {embed ? (
                    embed.kind === "iframe" ? (
                      <iframe
                        src={embed.src}
                        title={`${tut.title} 教学视频`}
                        allow="autoplay; fullscreen; encrypted-media"
                        allowFullScreen
                        scrolling="no"
                      />
                    ) : (
                      <video src={embed.src} controls playsInline />
                    )
                  ) : (
                    <div className="video-placeholder">
                      <p>
                        暂无真实片源。当前以 <b>3D 多机位演示</b> 呈现，点击上方机位可切换主舞台视角。
                      </p>
                      <p className="faint">
                        如需接入真实教学视频，将 mp4 放入 <span className="mono">/public/video/</span>
                        并在教程中配置 <span className="mono">videoSrc</span> 即可。
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <div className="row">
                <button className="btn" onClick={() => setPhase("prep")}>
                  返回准备
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setPhase("success")}
                  disabled={stepIdx < tut.steps.length - 1}
                  title={stepIdx < tut.steps.length - 1 ? "请先完成全部步骤" : ""}
                >
                  下一步：成功标志
                </button>
              </div>
            </section>
          )}

          {phase === "success" && (
            <section className="card stack">
              <h2>成功标志</h2>
              <div className="check-list">
                {tut.successSigns.map((s, i) => (
                  <div className="check-item" key={i}>
                    <span className="check-box">✓</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="notice notice-ok">全部符合即视为复位成功；任何一项不符合都应停止并复查影像。</div>
              <div className="row">
                <button className="btn" onClick={() => setPhase("steps")}>
                  返回分步操作
                </button>
                <button className="btn btn-primary" onClick={() => setPhase("aftercare")}>
                  下一步：术后护理
                </button>
              </div>
            </section>
          )}

          {phase === "aftercare" && (
            <section className="card stack">
              <h2>术后护理</h2>
              <div className="check-list">
                {tut.aftercare.map((s, i) => (
                  <div className="check-item" key={i}>
                    <span className="check-box">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="row">
                <button className="btn" onClick={() => setPhase("success")}>
                  返回成功标志
                </button>
                <button className="btn btn-primary" onClick={() => setPhase("warnings")}>
                  最后一步：错误警示
                </button>
              </div>
            </section>
          )}

          {phase === "warnings" && (
            <section className="card stack">
              <h2>错误警示</h2>
              <div className="stack">
                {tut.warnings.map((s, i) => (
                  <div className="notice notice-danger" key={i}>
                    {s}
                  </div>
                ))}
              </div>
              <div className="row">
                <button className="btn" onClick={() => setPhase("aftercare")}>
                  返回术后护理
                </button>
                <button className="btn btn-primary" onClick={() => navigate("/tutorials")}>
                  完成，返回教程库
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {compare && (
        <section className="stack">
          <h2>正常位 / 脱位分屏对比</h2>
          <div className="split-view">
            <ComparePane tut={tut} dislocated={false} />
            <ComparePane tut={tut} dislocated />
          </div>
        </section>
      )}

    </main>
  );
}
