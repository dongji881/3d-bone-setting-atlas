import * as THREE from "three";

/**
 * 患者体位。身体根节点位于躯干几何中心，围绕该点旋转即可从标准解剖位
 * 过渡到手法所需体位；髋—膝—踝为可折叠的关节链，用于坐位。
 */
export type PoseId = "standing" | "supine" | "prone" | "left" | "right" | "sitting";

export interface PoseDef {
  id: PoseId;
  label: string;
  hint: string;
  body: [number, number, number];
  bodyPos: [number, number, number];
  thigh: number;
  shank: number;
  support: "none" | "bed" | "chair";
  supportAxis: "z" | "x";
  /** 床面（或坐面）在世界坐标下的高度；支撑物不随身体旋转 */
  bedTop?: number;
  /** 枕头在世界坐标下的位置（床头端） */
  pillow?: [number, number];
  /** 该体位下的默认观察方位角（弧度，0 = 正面） */
  yaw?: number;
}

const D = Math.PI / 180;

export const POSES: PoseDef[] = [
  {
    id: "standing",
    label: "站立位",
    hint: "标准解剖位，用于体表定位与分层观察",
    body: [0, 0, 0],
    bodyPos: [0, 0.85, 0],
    thigh: 0,
    shank: 0,
    support: "none",
    supportAxis: "z",
  },
  {
    id: "supine",
    label: "仰卧位",
    hint: "肩、髋、膝、踝复位最常用体位",
    body: [-90 * D, 0, 0],
    bodyPos: [0, 0.88, 0],
    thigh: 0,
    shank: 0,
    support: "bed",
    supportAxis: "z",
    bedTop: 0.75,
    pillow: [0, -0.98],
    yaw: Math.PI / 2,
  },
  {
    id: "prone",
    label: "俯卧位",
    hint: "脊柱后部、骶髂关节手法常用体位",
    body: [90 * D, 0, 0],
    bodyPos: [0, 0.88, 0],
    thigh: 0,
    shank: 0,
    support: "bed",
    supportAxis: "z",
    bedTop: 0.75,
    pillow: [0, 0.98],
    yaw: Math.PI / 2,
  },
  {
    id: "left",
    label: "左侧卧位",
    hint: "腰椎斜扳、肩部手法常用体位",
    body: [0, 0, 90 * D],
    bodyPos: [0, 0.88, 0],
    thigh: 0,
    shank: 0,
    support: "bed",
    supportAxis: "x",
    bedTop: 0.71,
    pillow: [-0.98, 0],
  },
  {
    id: "right",
    label: "右侧卧位",
    hint: "腰椎斜扳、肩部手法常用体位",
    body: [0, 0, -90 * D],
    bodyPos: [0, 0.88, 0],
    thigh: 0,
    shank: 0,
    support: "bed",
    supportAxis: "x",
    bedTop: 0.71,
    pillow: [0.98, 0],
  },
  {
    id: "sitting",
    label: "坐位",
    hint: "颞下颌、肘、前臂及颈项部手法常用体位",
    body: [0, 0, 0],
    bodyPos: [0, 0.49, 0],
    thigh: -90 * D,
    shank: 90 * D,
    support: "chair",
    supportAxis: "z",
    bedTop: 0.43,
  },
];

export const poseById = new Map(POSES.map((p) => [p.id, p]));

/** BodyParts3D 模型的身体几何中心（米制，Y 轴向上，面部朝向 +Z） */
export const BODY_CENTER: THREE.Vector3 = new THREE.Vector3(0, 0.78, 0.11);

export const PIVOT_HIP = new THREE.Vector3(0, 0.82, 0.075);
export const PIVOT_KNEE = new THREE.Vector3(0, 0.376, 0.078);
export const PIVOT_ANKLE = new THREE.Vector3(0, 0.0, 0.078);

const UPPER_EXTRA = new Set(["humerus", "ulna", "radius", "scapula", "clavicle", "pelvis", "hip-bone", "sacrum"]);
const FOOT_RE = /toe|metatarsal|cuneiform|cuboid|navicular|calcaneus|talus|sesamoid/;

export type LimbName = "upper" | "thigh" | "shank" | "foot";

export function rigGroupFor(id: string): LimbName {
  if (id === "femur" || id === "patella") return "thigh";
  if (id === "tibia" || id === "fibula") return "shank";
  if (FOOT_RE.test(id)) return "foot";
  if (UPPER_EXTRA.has(id)) return "upper";
  return "upper";
}

export interface Rig {
  root: THREE.Group;
  upper: THREE.Group;
  thigh: THREE.Group;
  shank: THREE.Group;
  foot: THREE.Group;
  support: THREE.Group;
  apply(pose: PoseDef): void;
  current: PoseDef;
}

/**
 * 关节节点。`content` 使用原始模型坐标（米），因此子节点的局部位置直接以
 * 模型坐标表达，再减去父关节的原点即可。 */
function localPivot(pivot: THREE.Vector3, parentOrigin: THREE.Vector3 = new THREE.Vector3()): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pivot).sub(parentOrigin);
  return g;
}

function disposeGroup(group: THREE.Group): void {
  while (group.children.length) {
    const child = group.children.pop()!;
    child.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
  }
}

function panel(w: number, h: number, d: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 }),
  );
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function buildSupport(group: THREE.Group, pose: PoseDef): void {
  disposeGroup(group);
  group.visible = pose.support !== "none";
  if (!group.visible) return;

  const surface = "#31404f";
  const legColor = "#1b2531";

  if (pose.support === "bed") {
    const long = 2.3;
    const bedTop = pose.bedTop ?? 0.75;
    const matH = 0.07;

    const top = panel(0.8, matH, long, surface);
    top.position.set(0, bedTop - matH / 2, 0);
    if (pose.supportAxis === "x") top.rotation.y = Math.PI / 2;
    group.add(top);

    const legH = Math.max(bedTop - matH, 0.2);
    const legPos = legH / 2;
    const offsets: [number, number][] = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    for (const [sx, sz] of offsets) {
      const l = panel(0.06, legH, 0.06, legColor);
      l.position.set(
        pose.supportAxis === "x" ? sz * (long / 2 - 0.15) : sx * 0.33,
        legPos,
        pose.supportAxis === "x" ? sx * 0.33 : sz * (long / 2 - 0.15),
      );
      group.add(l);
    }

    if (pose.pillow) {
      const pillow = panel(0.46, 0.1, 0.3, "#46596c");
      pillow.position.set(pose.pillow[0], bedTop + 0.03, pose.pillow[1]);
      if (pose.supportAxis === "x") pillow.rotation.y = Math.PI / 2;
      group.add(pillow);
    }
  } else {
    const seatTop = pose.bedTop ?? 0.43;
    const seat = panel(0.52, 0.06, 0.72, surface);
    seat.position.set(0, seatTop - 0.03, 0.19);
    group.add(seat);
    for (const [sx, sz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as [number, number][]) {
      const l = panel(0.05, seatTop - 0.06, 0.05, legColor);
      l.position.set(sx * 0.21, (seatTop - 0.06) / 2, 0.19 + sz * 0.31);
      group.add(l);
    }
    const floor = panel(1.4, 0.03, 1.4, "#16202b");
    floor.position.set(0, 0.015, 0);
    group.add(floor);
  }
}

function buildStandingFloor(group: THREE.Group): void {
  disposeGroup(group);
  group.visible = true;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 48),
    new THREE.MeshStandardMaterial({ color: "#141d27", roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
}

export function createRig(): Rig {
  const root = new THREE.Group();
  const content = new THREE.Group();
  content.position.copy(BODY_CENTER).negate();
  root.add(content);

  const upper = new THREE.Group();
  content.add(upper);

  const thigh = localPivot(PIVOT_HIP);
  const shank = localPivot(PIVOT_KNEE, PIVOT_HIP);
  const foot = localPivot(PIVOT_ANKLE, PIVOT_KNEE);
  thigh.add(shank);
  shank.add(foot);
  content.add(thigh);

  const support = new THREE.Group();
  buildStandingFloor(support);

  const rig: Rig = {
    root,
    upper,
    thigh,
    shank,
    foot,
    support,
    current: POSES[0],
    apply(pose: PoseDef) {
      rig.current = pose;
      root.rotation.set(...pose.body);
      root.position.set(...pose.bodyPos);
      thigh.rotation.x = pose.thigh;
      shank.rotation.x = pose.shank;
      foot.rotation.x = 0;
      if (pose.support === "none") buildStandingFloor(support);
      else buildSupport(support, pose);
    },
  };

  return rig;
}

/** 各肢体节点在模型坐标系下的原点：结构挂到对应节点时用它做补偿位移 */
export function limbOriginOf(name: LimbName): THREE.Vector3 {
  switch (name) {
    case "thigh":
      return PIVOT_HIP.clone();
    case "shank":
      return PIVOT_KNEE.clone();
    case "foot":
      return PIVOT_ANKLE.clone();
    default:
      return new THREE.Vector3();
  }
}

/** 结构所属的肢体节点：只有下肢需要跟随坐位折叠 */
export function limbNodeOf(id: string, rig: Rig): { name: LimbName; node: THREE.Group } {
  const name = rigGroupFor(id);
  if (name === "thigh") return { name, node: rig.thigh };
  if (name === "shank") return { name, node: rig.shank };
  if (name === "foot") return { name, node: rig.foot };
  return { name: "upper", node: rig.upper };
}
