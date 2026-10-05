import { SomakineCatalog, type DataPack, type Region, type RegionId, type Structure, type StructureId, type StructureType } from "@somakine/core";
import { bodyParts3DMusculoskeletal } from "@somakine/bodyparts3d-musculoskeletal";

export const LOCALE = "zh-CN";

export const pack: DataPack = bodyParts3DMusculoskeletal as unknown as DataPack;
export const catalog = new SomakineCatalog(pack);

const structureIndex = new Map<StructureId, Structure>();
for (const s of pack.structures) structureIndex.set(s.id, s);

export function structureOf(id: StructureId): Structure | undefined {
  return structureIndex.get(id);
}

export function labelOf(id: string): string {
  return catalog.label(id, LOCALE);
}

export function regionLabel(id: RegionId | string): string {
  return catalog.label(id, LOCALE);
}

export function regions(): readonly Region[] {
  return catalog.regions();
}

export function sid(short: string): StructureId {
  return `somakine:structure:${short}`;
}

export function rid(short: string): RegionId {
  return `somakine:region:${short}`;
}

export interface LayerMeta {
  type: StructureType;
  name: string;
  color: string;
  desc: string;
}

export const LAYERS: LayerMeta[] = [
  { type: "skin", name: "皮肤 / 体表", color: "#f0c9a8", desc: "体表轮廓与体表定位（程序化生成）" },
  { type: "muscle", name: "肌肉", color: "#d4736c", desc: "浅层与深层肌群" },
  { type: "bone", name: "骨骼", color: "#e8e2d2", desc: "全身骨性结构" },
  { type: "ligament", name: "韧带", color: "#ffd166", desc: "关节稳定结构" },
  { type: "joint", name: "关节", color: "#7fd3ff", desc: "关节间隙与关节面标记" },
  { type: "tendon", name: "肌腱", color: "#f5f0e6", desc: "肌腱与腱膜" },
];

export const LAYER_COLOR: Record<StructureType, string> = {
  skin: "#f0c9a8",
  muscle: "#d4736c",
  bone: "#e8e2d2",
  ligament: "#ffd166",
  joint: "#7fd3ff",
  tendon: "#f5f0e6",
};

export function countByType(type: StructureType): number {
  return pack.structures.filter((s) => s.type === type).length;
}

export function countInRegion(regionId: RegionId, type?: StructureType): number {
  return pack.structures.filter((s) => s.regionIds.includes(regionId) && (!type || s.type === type)).length;
}

export function structuresInRegion(regionId: RegionId, type?: StructureType): readonly Structure[] {
  return pack.structures.filter((s) => s.regionIds.includes(regionId) && (!type || s.type === type));
}

export function searchStructures(query: string, limit = 20): { id: StructureId; label: string; type: StructureType }[] {
  return catalog.search(query, LOCALE, limit).map((r) => ({ id: r.id, label: r.label, type: r.type }));
}
