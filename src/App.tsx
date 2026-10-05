import { useRoute, useSettings, navigate } from "./core/store";
import { DisclaimerGate, SafetyFooter, Toasts, useDocumentFlags } from "./ui/Chrome";
import HomePage from "./pages/HomePage";
import TutorialsPage from "./pages/TutorialsPage";
import TutorialDetailPage from "./pages/TutorialDetailPage";
import AtlasPage from "./pages/AtlasPage";
import SearchPage from "./pages/SearchPage";
import FavoritesPage from "./pages/FavoritesPage";
import SettingsPage from "./pages/SettingsPage";

const NAV = [
  { path: "/", label: "首页" },
  { path: "/tutorials", label: "教程库" },
  { path: "/atlas", label: "解剖浏览" },
  { path: "/search", label: "搜索" },
  { path: "/favorites", label: "收藏" },
  { path: "/settings", label: "设置" },
];

function split(route: string): [string, URLSearchParams] {
  const i = route.indexOf("?");
  if (i < 0) return [route, new URLSearchParams()];
  return [route.slice(0, i), new URLSearchParams(route.slice(i + 1).trim())];
}

function Page({ path, query }: { path: string; query: URLSearchParams }) {
  if (path.startsWith("/tutorials/")) {
    return <TutorialDetailPage id={path.slice("/tutorials/".length)} />;
  }
  switch (path) {
    case "/tutorials":
      return <TutorialsPage initialRegion={query.get("region")} />;
    case "/atlas":
      return (
        <AtlasPage joint={query.get("joint")} struct={query.get("struct")} query={query} />
      );
    case "/search":
      return <SearchPage />;
    case "/favorites":
      return <FavoritesPage />;
    case "/settings":
      return <SettingsPage />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  const settings = useSettings();
  const route = useRoute();
  useDocumentFlags(settings.theme, settings.elderMode);

  const [path, query] = split(route);
  const active = NAV.find((n) => n.path !== "/" && path.startsWith(n.path))?.path ?? "/";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/" onClick={() => navigate("/")}>
          <span className="brand-mark">正</span>
          <span>正骨学堂</span>
        </a>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={active === n.path ? "active" : ""}>
              {n.label}
              {n.path === "/favorites" && settings.favorites.length
                ? ` (${settings.favorites.length})`
                : ""}
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <button
            className="btn btn-sm"
            onClick={() => navigate("/tutorials")}
            title="快速进入教程"
          >
            开始学习
          </button>
        </div>
      </header>

      <Page path={path} query={query} />

      <SafetyFooter />
      <Toasts />
      {!settings.disclaimerAccepted && <DisclaimerGate />}
    </div>
  );
}
