import type { PoseId } from "../three/bodyRig";

export type Level = "public" | "pro";

/** 教程六段标准结构 */
export type PhaseId = "selfcheck" | "prep" | "steps" | "success" | "aftercare" | "warnings";

export interface PhaseDef {
  id: PhaseId;
  label: string;
  desc: string;
  icon: string;
}

export const PHASES: PhaseDef[] = [
  { id: "selfcheck", label: "损伤自查", desc: "先确认是否符合本手法的适应表现", icon: "1" },
  { id: "prep", label: "术前准备", desc: "体位、环境、器材与人员准备", icon: "2" },
  { id: "steps", label: "分步操作", desc: "标准手法的分步动画与参数", icon: "3" },
  { id: "success", label: "成功标志", desc: "判断复位是否完成的客观指标", icon: "4" },
  { id: "aftercare", label: "术后护理", desc: "固定、观察与康复要点", icon: "5" },
  { id: "warnings", label: "错误警示", desc: "常见错误与必须避免的操作", icon: "6" },
];

/** 手法参数标准化：每一步都必须标注的五项要素 */
export interface StepParams {
  /** 按压位置（对应专业骨骼标志） */
  site: string;
  /** 按压位置所对应的结构短 ID，用于在 3D 上高亮 */
  siteBones: string[];
  /** 力度等级 1（轻）— 5（重） */
  force: 1 | 2 | 3 | 4 | 5;
  /** 发力方向 */
  direction: string;
  /** 旋转 / 屈伸角度 */
  angle: string;
  /** 动作节奏 */
  rhythm: string;
}

/** 箭头（米制内容坐标），用于力度可视化；坐标空间由 Step.arrowSpace 决定 */
export interface ArrowSpec {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  label?: string;
}

export type CameraMode = "wide" | "joint" | "both";

export interface AnimSpec {
  /** 被平移的活动骨结构短 ID */
  structure: string;
  /** 目标位移（米，内容坐标）；仅做旋转的动作可省略 */
  offset?: [number, number, number];
  /** 目标旋转（弧度），用于旋扳类动作 */
  rot?: [number, number, number];
}

export interface Step {
  id: string;
  title: string;
  summary: string;
  params: StepParams;
  /** 3D 力度箭头 */
  arrows: ArrowSpec[];
  /**
   * 箭头坐标空间：
   * - "world"（默认）：内容坐标绝对值，适用于大关节
   * - "anchor"：相对关节锚点的偏移，适用于手指等绝对坐标不易估算的小关节
   */
  arrowSpace?: "world" | "anchor";
  /** 该步骤结束时活动骨的位移，用于动画演示 */
  anim?: AnimSpec;
  camera: CameraMode;
  /** 双视角同步：整体手法视角的机位 */
  wideView?: "front" | "side" | "top" | "back";
  /** 对应真实教学视频的时间点（秒），点击可跳转 */
  videoAt?: number;
  narration: string;
}

export interface Tutorial {
  id: string;
  title: string;
  subtitle: string;
  jointId: string;
  regionId: string;
  level: Level;
  summary: string;
  keywords: string[];
  /** 本手法可用的患者体位（首项为默认） */
  positions: PoseId[];
  /** 每个教程前置的禁忌症筛查清单 */
  contraindications: { id: string; text: string }[];
  selfCheck: string[];
  prep: string[];
  steps: Step[];
  successSigns: string[];
  aftercare: string[];
  warnings: string[];
  /** 教学视频多机位；未提供真实片源时自动回落到 3D 多机位演示 */
  videoCameras: { id: string; label: string; view: "front" | "side" | "top" | "back" | "both" }[];
  /** 真实教学视频路径（可选，置于 /public/video/ 下） */
  videoSrc?: string;
  /** 该关节的活动骨（脱位演示中被移动的骨） */
  mobileBone: string;
  /** 脱位方向（米，内容坐标），分屏对比视图使用 */
  dislocation: [number, number, number];
  /** 脱位演示中的错位颜色 */
  dislocationColor?: string;
}

export function phaseOf(id: PhaseId): PhaseDef {
  return PHASES.find((p) => p.id === id)!;
}
