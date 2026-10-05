export type VideoEmbed =
  | { kind: "iframe"; src: string; watchUrl: string }
  | { kind: "file"; src: string };

const BILI_PAGE = /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/(BV1[A-Za-z0-9]+)/i;
const BILI_PLAYER = /(?:https?:\/\/)?player\.bilibili\.com\/player\.html[^"']*/i;
const YOUTUBE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;

export function videoEmbed(url?: string | null): VideoEmbed | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;

  const player = raw.match(BILI_PLAYER);
  if (player) return { kind: "iframe", src: raw, watchUrl: raw };

  const bili = raw.match(BILI_PAGE);
  if (bili) {
    const bvid = bili[1];
    return {
      kind: "iframe",
      src: `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&autoplay=0&high_quality=1&danmaku=0`,
      watchUrl: `https://www.bilibili.com/video/${bvid}`,
    };
  }

  const yt = raw.match(YOUTUBE);
  if (yt) {
    return {
      kind: "iframe",
      src: `https://www.youtube.com/embed/${yt[1]}?rel=0`,
      watchUrl: raw,
    };
  }

  return { kind: "file", src: raw };
}
