import { useEffect, type ReactNode } from "react";
import { setSettings, toast, useToasts } from "../core/store";

export function Toasts() {
  const items = useToasts();
  if (!items.length) return null;
  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div className="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function LevelChip({ level }: { level: "public" | "pro" }) {
  return level === "public" ? (
    <span className="chip chip-public">大众级</span>
  ) : (
    <span className="chip chip-pro">专业级</span>
  );
}

export function Modal({
  title,
  children,
  wide,
  onClose,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? " modal-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SafetyFooter() {
  return (
    <footer className="safety-footer">
      正骨学堂 · 3D 关节复位教学演示 · 仅供医学科普与教学参考，不构成医疗建议。
      任何手法均存在风险，请在具备资质的专业人员指导下进行，紧急情况请立即就医。
      <br />
      解剖底座：BodyParts3D / 4.0（CC BY 4.0）· Somakine Viewer
    </footer>
  );
}

/** 免责声明门禁：未接受前所有页面被遮罩阻断 */
export function DisclaimerGate() {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>使用前须知</h2>
        <div className="stack">
          <div className="notice notice-danger">
            本程序为 <b>3D 交互式关节复位教学演示工具</b>
            ，所有手法动画、力度标注与文字说明均用于医学科普与教学，<b>不构成医疗建议、诊断或治疗方案</b>。
          </div>
          <ul className="check-list">
            <li className="check-item on">
              <span className="check-box">!</span>
              <span>
                实际复位须由具备资质的医务人员在明确诊断（X 线 / CT）后实施；本工具不能替代影像学检查与临床评估。
              </span>
            </li>
            <li className="check-item on">
              <span className="check-box">!</span>
              <span>
                骨折、骨质疏松、肿瘤、感染、神经血管损伤、陈旧性损伤等情形下进行手法复位，可能造成不可逆伤害。
              </span>
            </li>
            <li className="check-item on">
              <span className="check-box">!</span>
              <span>
                标注为「专业级」的内容风险较高，大众模式下默认隐藏；任何操作前请先完成禁忌症筛查。
              </span>
            </li>
            <li className="check-item on">
              <span className="check-box">!</span>
              <span>如遇剧烈疼痛、肢体麻木、畸形、无法负重或症状加重，请立即停止并前往医院就诊。</span>
            </li>
          </ul>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  setSettings({ disclaimerAccepted: true, disclaimerAcceptedAt: new Date().toISOString() });
                  toast("已确认免责声明");
                }
              }}
            />
            <span>我已阅读并理解上述风险，同意仅在教学演示目的下使用本工具。</span>
          </label>
          <p className="faint">
            可在「设置」中随时查看或重新确认免责声明。本程序不会收集任何个人健康数据。
          </p>
        </div>
      </div>
    </div>
  );
}

export function useDocumentFlags(theme: string, elder: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-elder", elder ? "on" : "off");
  }, [theme, elder]);
}
