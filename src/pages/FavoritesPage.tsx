import { TUTORIALS } from "../content/tutorials";
import { navigate, useSettings } from "../core/store";
import { TutorialGrid } from "../ui/TutorialList";

export default function FavoritesPage() {
  const settings = useSettings();
  const items = TUTORIALS.filter(
    (t) => settings.favorites.includes(t.id) && (settings.mode === "pro" || t.level === "public"),
  );

  return (
    <main className="page stack">
      <div>
        <h1>我的收藏</h1>
        <p className="muted">收藏保存在本机浏览器中，不需要注册账号。</p>
      </div>
      {items.length ? (
        <TutorialGrid items={items} />
      ) : (
        <div className="notice">
          还没有收藏。可在教程列表或教程详情页点击「☆ 收藏」，
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/tutorials")}>
            去教程库看看
          </button>
        </div>
      )}
      {settings.mode === "public" && (
        <div className="faint">专业级教程在大众模式下不显示，切换内容分级后可见。</div>
      )}
    </main>
  );
}
