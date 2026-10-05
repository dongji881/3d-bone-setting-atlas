import { REGION_DEFS } from "../anatomy/atlas";
import { TUTORIALS, tutorialsOfRegion } from "../content/tutorials";
import { navigate, useSettings } from "../core/store";
import { LevelChip } from "../ui/Chrome";

export default function HomePage() {
  const settings = useSettings();
  const visible = settings.mode === "public" ? TUTORIALS.filter((t) => t.level === "public") : TUTORIALS;

  return (
    <main className="page stack">
      <section className="card" style={{ padding: "clamp(20px, 4vw, 40px)" }}>
        <div className="stack">
          <div className="row">
            <span className="chip chip-warn">教学演示 · 非医疗建议</span>
            <LevelChip level={settings.mode === "public" ? "public" : "pro"} />
          </div>
          <h1>3D 交互式关节复位教学</h1>
          <p className="muted" style={{ maxWidth: "62ch" }}>
            以人体解剖底座（BodyParts3D / 4.0）为模型，逐关节演示复位手法：可旋转、缩放、分层查看，
            按「自查 → 准备 → 分步操作 → 成功标志 → 术后护理 → 错误警示」六段结构学习，
            每一步都标注按压位置、力度等级、发力方向、角度与节奏。
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => navigate("/tutorials")}>
              进入教程库
            </button>
            <button className="btn" onClick={() => navigate("/atlas")}>
              自由浏览解剖
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/settings")}>
              内容分级与长辈模式
            </button>
          </div>
        </div>
      </section>

      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>按部位查找</h2>
          <span className="faint">共 {TUTORIALS.length} 套教程</span>
        </div>
        <div className="grid-cards">
          {REGION_DEFS.map((r) => {
            const list = tutorialsOfRegion(r.id);
            const enabled = list.filter((t) => t.level === "public" || settings.mode === "pro");
            return (
              <button
                key={r.id}
                className="result-row"
                onClick={() => navigate(enabled[0] ? `/tutorials/${enabled[0].id}` : "/tutorials")}
              >
                <div style={{ flex: 1 }}>
                  <div className="step-title">{r.label}</div>
                  <div className="faint">{r.injuries.slice(0, 3).join(" · ")}</div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <span className="chip">{enabled.length} 套教程</span>
                    {r.keywords.slice(0, 3).map((k) => (
                      <span className="chip" key={k}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                <span aria-hidden>→</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h2>推荐教程</h2>
        <div className="grid-cards">
          {visible.slice(0, 6).map((t) => (
            <button key={t.id} className="result-row" onClick={() => navigate(`/tutorials/${t.id}`)}>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="step-title">{t.title}</span>
                  <LevelChip level={t.level} />
                </div>
                <div className="faint">{t.subtitle}</div>
                <p className="muted" style={{ fontSize: "0.9em", margin: "6px 0 0" }}>
                  {t.summary.slice(0, 48)}…
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="notice notice-danger">
        <b>安全提示：</b>骨折未排除、开放性伤口、神经血管损伤、病理性骨病、陈旧性损伤等情形下禁止手法复位。
        进入任何教程前必须完成禁忌症筛查；出现症状加重请立即停止并就医。
      </div>
    </main>
  );
}
