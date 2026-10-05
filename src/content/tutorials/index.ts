import { HAND_TUTORIALS } from "./hand";
import { TMJ_TUTORIALS } from "./tmj";
import { SHOULDER_TUTORIALS } from "./shoulder";
import { ARM_TUTORIALS } from "./arm";
import { LOWER_TUTORIALS } from "./lower";
import type { Tutorial } from "../types";

export * from "../types";

export const TUTORIALS: Tutorial[] = [
  ...HAND_TUTORIALS,
  ...TMJ_TUTORIALS,
  ...ARM_TUTORIALS,
  ...SHOULDER_TUTORIALS,
  ...LOWER_TUTORIALS,
];

export function tutorialOf(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

export function tutorialsOfRegion(regionId: string): Tutorial[] {
  return TUTORIALS.filter((t) => t.regionId === regionId);
}

export function searchTutorials(query: string, level: "public" | "pro" = "pro"): Tutorial[] {
  const q = query.trim().toLowerCase();
  const pool = level === "public" ? TUTORIALS.filter((t) => t.level === "public") : TUTORIALS;
  if (!q) return pool;
  return pool.filter((t) => {
    const hay = [t.title, t.subtitle, t.summary, t.regionId, t.jointId, ...t.keywords]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
