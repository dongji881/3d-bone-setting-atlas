import type { StructureType } from "@somakine/core";
import { pack, rid } from "./pack";

const shortOf = (id: string) => id.replace("somakine:structure:", "");

/** 某区域、某些分层下的结构短 ID 集合；regionId 为 null 表示全身 */
export function idsFor(regionId: string | null, types: StructureType[]): string[] {
  const out = new Set<string>();
  for (const s of pack.structures) {
    if (!types.includes(s.type)) continue;
    if (regionId && !s.regionIds.includes(rid(regionId))) continue;
    out.add(shortOf(s.id));
  }
  return [...out];
}

export function idsOfType(type: StructureType): string[] {
  return pack.structures.filter((s) => s.type === type).map((s) => shortOf(s.id));
}

export function countFor(regionId: string | null, type: StructureType): number {
  return pack.structures.filter(
    (s) => s.type === type && (!regionId || s.regionIds.includes(rid(regionId))),
  ).length;
}

/** 教程默认展示：骨骼 + 韧带 + 肌腱 + 关节标记所需的目标骨 */
export const TUTORIAL_TYPES: StructureType[] = ["bone", "ligament", "tendon"];
