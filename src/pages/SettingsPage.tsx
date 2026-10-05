import { useState } from "react";
import { clearAnatomyCache, anatomyCacheReady, precacheAnatomy } from "../core/offline";
import { setSettings, toast, useSettings, getSettings } from "../core/store";
import { Modal } from "../ui/Chrome";

export default function SettingsPage() {
  const s = useSettings();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [riskOpen, setRiskOpen] = useState(false);

  async function enableOffline() {
    setBusy(true);
    try {
      await precacheAnatomy((done, total) => setProgress({ done, total }));
      setSettings({ offlineEnabled: true, offlineReady: true });
      toast("解剖资产已缓存，可离线使用");
    } catch (e) {
      toast(e instanceof Error ? e.message : "离线缓存失败");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function disableOffline() {
    setBusy(true);
    await clearAnatomyCache();
    setSettings({ offlineEnabled: false, offlineReady: false });
    setBusy(false);
    toast("已清除离线缓存");
  }

  return (
    <main className="page stack" style={{ maxWidth: 860 }}>
      <div>
        <h1>设置</h1>
        <p className="muted">所有设置仅保存在本机浏览器，不会上传。</p>
      </div>

      <section className="panel">
        <div className="panel-head">内容分级</div>
        <div className="panel-body">
          <div className="seg">
            <button
              className={s.mode === "public" ? "on" : ""}
              onClick={() => setSettings({ mode: "public" })}
            >
              大众模式
            </button>
            <button
              className={s.mode === "pro" ? "on" : ""}
              onClick={() => (s.mode === "pro" ? undefined : setRiskOpen(true))}
            >
              专业模式
            </button>
          </div>
          <p className="faint">
            大众模式仅显示手指、颞下颌等低风险小关节教程；专业模式包含肩、肘、髋、脊柱等高风险手法，
            需完成风险确认后开启。
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">显示与无障碍</div>
        <div className="panel-body">
          <div className="layer-row">
            <span className="layer-name">
              长辈模式
              <span className="faint" style={{ display: "block", fontSize: "0.8em" }}>
                放大字号与圆角，提升对比度
              </span>
            </span>
            <button
              className={`switch${s.elderMode ? " on" : ""}`}
              onClick={() => setSettings({ elderMode: !s.elderMode })}
              aria-label="切换长辈模式"
            />
          </div>
          <div className="layer-row">
            <span className="layer-name">
              浅色主题
              <span className="faint" style={{ display: "block", fontSize: "0.8em" }}>
                关闭后为深色主题
              </span>
            </span>
            <button
              className={`switch${s.theme === "light" ? " on" : ""}`}
              onClick={() => setSettings({ theme: s.theme === "light" ? "dark" : "light" })}
              aria-label="切换主题"
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">离线可用</div>
        <div className="panel-body">
          <p className="muted" style={{ margin: 0 }}>
            下载解剖模型资产到本机（约 31 MB），之后在无网络环境下也能打开已缓存的模型与界面。
          </p>
          <div className="row">
            {!s.offlineEnabled ? (
              <button className="btn btn-primary" disabled={busy} onClick={enableOffline}>
                {busy ? "缓存中…" : "开启离线可用"}
              </button>
            ) : (
              <button className="btn" disabled={busy} onClick={disableOffline}>
                清除离线缓存
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() =>
                anatomyCacheReady().then((ok) => toast(ok ? "离线资产完整" : "离线资产不完整"))
              }
            >
              检查完整性
            </button>
          </div>
          {progress && (
            <div className="force-meter">
              <i style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
          )}
          {progress && (
            <span className="faint">
              {progress.done} / {progress.total} 个模型
            </span>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">安全与免责</div>
        <div className="panel-body">
          <div className="notice notice-danger">
            免责声明状态：
            <b>{s.disclaimerAccepted ? `已于 ${s.disclaimerAcceptedAt ?? "此前"} 接受` : "未接受"}</b>
          </div>
          <button
            className="btn"
            onClick={() => {
              setSettings({ disclaimerAccepted: false, disclaimerAcceptedAt: null });
              toast("请重新确认免责声明");
            }}
          >
            重新确认免责声明
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">数据</div>
        <div className="panel-body">
          <p className="faint" style={{ margin: 0 }}>
            本机存储键：<span className="mono">zgxt.settings.v1</span>
          </p>
          <button
            className="btn btn-danger"
            onClick={() => {
              localStorage.removeItem("zgxt.settings.v1");
              location.reload();
            }}
          >
            清除本机设置
          </button>
        </div>
      </section>

      {riskOpen && (
        <Modal title="开启专业模式" onClose={() => setRiskOpen(false)}>
          <div className="stack">
            <div className="notice notice-danger">
              专业模式包含肩关节、肘关节、髋关节、脊柱等<b>高风险闭合复位手法</b>。
              这些操作若在骨折未排除、神经血管损伤或无麻醉条件下实施，可能导致骨折、神经损伤甚至永久性功能障碍。
            </div>
            <ul className="check-list">
              <li className="check-item on">
                <span className="check-box">!</span>
                <span>内容仅供具备资质的医务人员教学参考，不作为临床操作依据。</span>
              </li>
              <li className="check-item on">
                <span className="check-box">!</span>
                <span>每个教程进入前仍需完成禁忌症筛查，未通过筛查将无法查看分步操作。</span>
              </li>
            </ul>
            <div className="row">
              <button
                className="btn btn-danger"
                onClick={() => {
                  setSettings({ mode: "pro" });
                  setRiskOpen(false);
                  toast("已切换到专业模式");
                }}
              >
                我已知悉风险，开启
              </button>
              <button className="btn" onClick={() => setRiskOpen(false)}>
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}
      <span className="faint">当前分级：{getSettings().mode === "pro" ? "专业模式" : "大众模式"}</span>
    </main>
  );
}
