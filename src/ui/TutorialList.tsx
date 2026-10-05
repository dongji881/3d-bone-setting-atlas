import { TUTORIALS } from "../content/tutorials";
import type { Tutorial } from "../content/types";
import { navigate, toggleFavorite, useSettings, toast } from "../core/store";
import { LevelChip } from "./Chrome";

export function useFilteredTutorials(opts: {
  query?: string;
  level?: "public" | "pro";
  favoritesOnly?: boolean;
  favorites?: string[];
  regionId?: string | null;
}): Tutorial[] {
  const s = useSettings();
  const level = opts.level ?? s.mode;
  const q = (opts.query ?? "").trim().toLowerCase();
  return TUTORIALS.filter((t) => {
    if (level === "public" && t.level !== "public") return false;
    if (opts.regionId && t.regionId !== opts.regionId) return false;
    if (opts.favoritesOnly && !s.favorites.includes(t.id)) return false;
    if (!q) return true;
    const hay = [t.title, t.subtitle, t.summary, t.regionId, t.jointId, ...t.keywords]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function TutorialCard({ t }: { t: Tutorial }) {
  const s = useSettings();
  const fav = s.favorites.includes(t.id);
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <LevelChip level={t.level} />
        <button
          className={`btn btn-sm${fav ? " btn-primary" : " btn-ghost"}`}
          onClick={() => {
            const on = toggleFavorite(t.id);
            toast(on ? "已收藏" : "已取消收藏");
          }}
          title={fav ? "取消收藏" : "收藏"}
        >
          {fav ? "★ 已收藏" : "☆ 收藏"}
        </button>
      </div>
      <div>
        <div className="step-title" style={{ fontSize: "1.05em" }}>
          {t.title}
        </div>
        <div className="faint">{t.subtitle}</div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.92em" }}>
        {t.summary}
      </p>
      <div className="tag-list">
        {t.keywords.slice(0, 4).map((k) => (
          <span className="chip" key={k}>
            {k}
          </span>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="faint">{t.steps.length} 步 · {t.positions.length} 种体位</span>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/tutorials/${t.id}`)}>
          开始学习
        </button>
      </div>
    </div>
  );
}

export function TutorialGrid({ items }: { items: Tutorial[] }) {
  if (!items.length) {
    return <div className="notice">没有匹配的教程。可尝试更换关键词，或在设置中切换到「专业级」内容。</div>;
  }
  return (
    <div className="grid-cards">
      {items.map((t) => (
        <TutorialCard key={t.id} t={t} />
      ))}
    </div>
  );
}
