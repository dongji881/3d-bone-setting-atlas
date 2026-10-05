export interface JointDef {
  /** 关节的稳定标识，用于教程、锚点与对比视图 */
  id: string;
  label: string;
  region: string;
  /** [固定骨, 活动骨] 结构短 ID；活动骨在脱位动画中被平移 */
  bones: [string, string];
  level: "public" | "pro";
  injuries: string[];
  keywords: string[];
  /** 默认锚点侧别，配对结构只在该侧放置关节标记 */
  side: "right" | "left";
}

export const JOINTS: JointDef[] = [
  {
    id: "tmj",
    label: "颞下颌关节",
    region: "head-neck",
    bones: ["temporal-bone", "mandible"],
    level: "public",
    injuries: ["颞下颌关节前脱位（掉下巴）", "颞下颌关节半脱位", "咀嚼肌紊乱"],
    keywords: ["下巴脱臼", "下颌脱位", "掉下巴", "张不开嘴", "咀嚼痛", "颞下颌", "下巴", "颌关节"],
    side: "right",
  },
  {
    id: "mcp",
    label: "掌指关节",
    region: "wrist-hand",
    bones: ["second-metacarpal-bone", "proximal-phalanx-of-index-finger"],
    level: "public",
    injuries: ["掌指关节侧脱位", "掌指关节扭伤", "侧副韧带损伤"],
    keywords: ["手指根部脱位", "掌指关节", "手指错位", "指根肿胀", "攥不住拳"],
    side: "right",
  },
  {
    id: "pip",
    label: "近节指间关节",
    region: "wrist-hand",
    bones: ["proximal-phalanx-of-index-finger", "middle-phalanx-of-index-finger"],
    level: "public",
    injuries: ["近节指间关节背侧脱位", "侧副韧带撕裂", "锤状指畸形"],
    keywords: ["手指脱位", "指间关节", "手指掰直不了", "手指变形", "手指肿胀", "扳机指"],
    side: "right",
  },
  {
    id: "dip",
    label: "远节指间关节",
    region: "wrist-hand",
    bones: ["middle-phalanx-of-index-finger", "distal-phalanx-of-index-finger"],
    level: "public",
    injuries: ["远节指间关节脱位", "锤状指（伸肌腱止点损伤）", "指端挫伤"],
    keywords: ["指尖脱位", "远节指间", "手指末节", "锤状指", "指尖变形"],
    side: "right",
  },
  {
    id: "gh",
    label: "盂肱关节（肩关节）",
    region: "shoulder",
    bones: ["scapula", "humerus"],
    level: "pro",
    injuries: ["肩关节前脱位（最常见）", "肩关节后脱位", "Bankart 损伤", "Hill-Sachs 损伤"],
    keywords: ["肩膀脱臼", "肩关节脱位", "方肩畸形", "搭肩试验阳性", "肩膀抬不起来", "肩关节"],
    side: "right",
  },
  {
    id: "hu",
    label: "肱尺关节（肘关节）",
    region: "elbow-forearm",
    bones: ["humerus", "ulna"],
    level: "pro",
    injuries: ["肘关节后脱位", "肘关节侧方脱位", "合并桡骨头骨折"],
    keywords: ["肘关节脱位", "肘部错位", "胳膊伸不直", "肘关节", "肘部肿胀"],
    side: "right",
  },
  {
    id: "radial-head",
    label: "桡骨小头",
    region: "elbow-forearm",
    bones: ["humerus", "radius"],
    level: "pro",
    injuries: ["桡骨小头半脱位（牵拉肘）", "环状韧带嵌顿"],
    keywords: ["牵拉肘", "桡骨小头", "小孩胳膊拽了", "前臂不能旋后", "肘外侧痛"],
    side: "right",
  },
  {
    id: "rc",
    label: "桡腕关节（腕关节）",
    region: "wrist-hand",
    bones: ["radius", "scaphoid"],
    level: "pro",
    injuries: ["桡腕关节脱位", "月骨脱位 / 月骨周围脱位", "舟骨骨折"],
    keywords: ["手腕脱位", "腕关节错位", "手腕变形", "腕关节", "摔了手腕"],
    side: "right",
  },
  {
    id: "hip",
    label: "髋关节",
    region: "hip-pelvis",
    bones: ["hip-bone", "femur"],
    level: "pro",
    injuries: ["髋关节后脱位", "髋关节前脱位", "股骨头骨折"],
    keywords: ["髋关节脱位", "胯骨错位", "腿短畸形", "髋关节", "走路跛行"],
    side: "right",
  },
  {
    id: "tf",
    label: "胫股关节（膝关节）",
    region: "knee",
    bones: ["femur", "tibia"],
    level: "pro",
    injuries: ["膝关节脱位", "髌股关节脱位", "交叉韧带损伤"],
    keywords: ["膝盖脱位", "膝关节错位", "膝盖骨跑了", "髌骨脱位", "膝关节"],
    side: "right",
  },
  {
    id: "patella",
    label: "髌股关节",
    region: "knee",
    bones: ["femur", "patella"],
    level: "pro",
    injuries: ["髌骨外侧脱位", "髌骨复发性脱位"],
    keywords: ["膝盖骨脱位", "髌骨跑了", "膝盖前面疼", "打软腿"],
    side: "right",
  },
  {
    id: "at",
    label: "距小腿关节（踝关节）",
    region: "ankle-foot",
    bones: ["tibia", "talus"],
    level: "pro",
    injuries: ["踝关节内翻损伤", "距骨倾斜 / 脱位", "下胫腓联合分离"],
    keywords: ["脚崴了", "踝关节扭伤", "脚踝肿胀", "踝关节", "崴脚"],
    side: "right",
  },
  {
    id: "lumbar-facet",
    label: "腰椎小关节",
    region: "spine-trunk",
    bones: ["fourth-lumbar-vertebra", "fifth-lumbar-vertebra"],
    level: "pro",
    injuries: ["腰椎小关节紊乱", "小关节交锁", "腰椎小关节滑膜嵌顿"],
    keywords: ["腰疼", "腰椎小关节", "闪腰", "弯不了腰", "腰椎紊乱", "腰部"],
    side: "right",
  },
];

export const jointById = new Map(JOINTS.map((j) => [j.id, j]));

export function jointsInRegion(region: string): JointDef[] {
  return JOINTS.filter((j) => j.region === region);
}

export function findJoints(query: string): JointDef[] {
  const q = query.trim();
  if (!q) return [];
  return JOINTS.filter(
    (j) =>
      j.label.includes(q) ||
      j.injuries.some((i) => i.includes(q)) ||
      j.keywords.some((k) => k.includes(q) || q.includes(k)),
  );
}

/* ------------------------------------------------------------------ */
/* 区域：常见损伤与症状关键词（疼痛点匹配用）                            */
/* ------------------------------------------------------------------ */

export interface RegionDef {
  id: string;
  label: string;
  side: "front" | "back" | "both";
  injuries: string[];
  keywords: string[];
}

export const REGION_DEFS: RegionDef[] = [
  {
    id: "head-neck",
    label: "头颈",
    side: "both",
    injuries: ["颞下颌关节前脱位", "颈椎小关节紊乱", "落枕", "颈部扭伤"],
    keywords: ["头痛", "脖子疼", "下巴", "张嘴痛", "落枕", "颈椎", "头晕", "下巴脱臼"],
  },
  {
    id: "shoulder",
    label: "肩部",
    side: "both",
    injuries: ["肩关节前脱位", "肩锁关节分离", "肩周炎", "肩袖损伤"],
    keywords: ["肩膀疼", "抬不起胳膊", "肩膀脱臼", "肩关节", "梳头痛", "肩部"],
  },
  {
    id: "elbow-forearm",
    label: "肘与前臂",
    side: "both",
    injuries: ["肘关节后脱位", "桡骨小头半脱位", "肱骨外上髁炎"],
    keywords: ["胳膊肘", "肘部疼", "伸不直", "网球肘", "前臂", "肘关节"],
  },
  {
    id: "wrist-hand",
    label: "腕与手",
    side: "both",
    injuries: ["指间关节脱位", "掌指关节脱位", "桡腕关节脱位", "月骨脱位", "腱鞘炎"],
    keywords: ["手指", "手腕", "手指变形", "手指肿", "扳机指", "手麻", "腕关节", "手指脱位"],
  },
  {
    id: "spine-trunk",
    label: "脊柱与躯干",
    side: "both",
    injuries: ["腰椎小关节紊乱", "胸椎小关节紊乱", "肋骨错位", "急性腰扭伤"],
    keywords: ["腰疼", "背疼", "闪腰", "驼背", "脊柱", "胸口疼", "腰间盘", "背部"],
  },
  {
    id: "hip-pelvis",
    label: "髋与骨盆",
    side: "both",
    injuries: ["髋关节后脱位", "骶髂关节错位", "耻骨联合分离"],
    keywords: ["胯疼", "髋关节", "屁股疼", "走路疼", "骨盆", "腹股沟"],
  },
  {
    id: "knee",
    label: "膝部",
    side: "both",
    injuries: ["髌骨外侧脱位", "膝关节脱位", "半月板损伤", "韧带撕裂"],
    keywords: ["膝盖", "膝关节", "打软腿", "上下楼疼", "膝盖骨", "蹲不下"],
  },
  {
    id: "ankle-foot",
    label: "踝与足",
    side: "both",
    injuries: ["踝关节扭伤", "距骨脱位", "Lisfranc 损伤", "足弓塌陷"],
    keywords: ["脚崴了", "脚踝", "崴脚", "脚疼", "足底", "脚趾"],
  },
];

export const regionDefById = new Map(REGION_DEFS.map((r) => [r.id, r]));

export function searchRegions(query: string): RegionDef[] {
  const q = query.trim();
  if (!q) return [];
  return REGION_DEFS.filter(
    (r) => r.label.includes(q) || r.injuries.some((i) => i.includes(q)) || r.keywords.some((k) => k.includes(q) || q.includes(k)),
  );
}
