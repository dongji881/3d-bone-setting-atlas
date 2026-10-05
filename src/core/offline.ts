import { pack } from "../anatomy/pack";

const CACHE = "zgxt-anatomy-v1";

function anatomyUrls(): string[] {
  const uris = pack.assets.filter((a) => a.kind === "gltf").map((a) => a.uri);
  return [...new Set(uris)].map((u) => new URL(u, document.baseURI).href);
}

export async function precacheAnatomy(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!("caches" in window)) throw new Error("当前浏览器不支持离线缓存");
  const cache = await caches.open(CACHE);
  const urls = anatomyUrls();
  let done = 0;
  onProgress?.(0, urls.length);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "reload" });
      if (res.ok) await cache.put(url, res);
    } catch {
      /* 单个资源失败不中断整体流程 */
    }
    done += 1;
    onProgress?.(done, urls.length);
  }
}

export async function anatomyCacheReady(): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open(CACHE);
    const urls = anatomyUrls();
    const hits = await Promise.all(urls.map((u) => cache.match(u)));
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

export async function clearAnatomyCache(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    await caches.delete(CACHE);
  } catch {
    /* ignore */
  }
}
