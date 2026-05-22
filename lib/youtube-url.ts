/** YouTube URL / ID parsing and validation */

const VIDEO_ID_RE = /^[\w-]{11}$/;

const HOST_PATTERNS = [
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?/i,
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\//i,
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\//i,
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\//i,
  /^(?:https?:\/\/)?youtu\.be\//i,
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\//i,
];

export function isYoutubeHostUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (VIDEO_ID_RE.test(trimmed)) return true;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return true;
    if (host === "youtube.com" || host === "m.youtube.com") {
      return (
        url.pathname === "/watch" ||
        url.pathname.startsWith("/shorts/") ||
        url.pathname.startsWith("/live/") ||
        url.pathname.startsWith("/embed/") ||
        url.pathname.startsWith("/v/")
      );
    }
    return false;
  } catch {
    return HOST_PATTERNS.some((re) => re.test(trimmed));
  }
}

export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return VIDEO_ID_RE.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && VIDEO_ID_RE.test(v)) return v;
      const pathMatch = url.pathname.match(
        /^\/(?:shorts|live|embed|v)\/([\w-]{11})/
      );
      if (pathMatch) return pathMatch[1];
    }
  } catch {
    // fall through to regex
  }

  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/(?:shorts|live|embed|v)\/)([\w-]{11})/
  );
  return watchMatch?.[1] ?? null;
}

export function validateYoutubeUrl(input: string): { ok: true; videoId: string } | { ok: false; error: string } {
  if (!input?.trim()) {
    return { ok: false, error: "Paste a YouTube link (youtube.com or youtu.be)." };
  }
  if (!isYoutubeHostUrl(input)) {
    return {
      ok: false,
      error: "That does not look like a YouTube link. Use youtube.com or youtu.be URLs only.",
    };
  }
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) {
    return {
      ok: false,
      error: "Could not read a video ID from that URL. Check the link and try again.",
    };
  }
  return { ok: true, videoId };
}
