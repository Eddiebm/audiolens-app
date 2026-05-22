import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { extractYoutubeVideoId } from "@/lib/youtube-url";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type YoutubeCaptionResult = {
  transcript: string;
  language: string;
};

export class YoutubeCaptionsUnavailableError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "YoutubeCaptionsUnavailableError";
    this.hint = hint;
  }
}

function browserFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      "User-Agent": BROWSER_UA,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

function mapTranscriptError(err: unknown, videoId: string): YoutubeCaptionsUnavailableError {
  const tabHint =
    "No captions found for this video. Use tab capture on /youtube instead — play the video in Chrome and share that tab's audio.";

  if (err instanceof YoutubeTranscriptDisabledError) {
    return new YoutubeCaptionsUnavailableError(
      "Captions are disabled on this video.",
      tabHint
    );
  }
  if (err instanceof YoutubeTranscriptNotAvailableError) {
    return new YoutubeCaptionsUnavailableError(
      "No captions are available for this video.",
      tabHint
    );
  }
  if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return new YoutubeCaptionsUnavailableError(
      `Captions are not available in the requested language for this video.`,
      tabHint
    );
  }
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return new YoutubeCaptionsUnavailableError(
      "Video unavailable — it may be private, deleted, or region-blocked.",
      "Private, unlisted, or restricted videos often have no public captions. Try tab capture if you can play the video in your browser."
    );
  }
  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return new YoutubeCaptionsUnavailableError(
      "YouTube rate-limited caption requests. Wait a minute and try again, or use tab capture.",
      tabHint
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (
    lower.includes("disabled") ||
    lower.includes("no transcript") ||
    lower.includes("not available")
  ) {
    return new YoutubeCaptionsUnavailableError(message, tabHint);
  }

  return new YoutubeCaptionsUnavailableError(
    `Could not load captions for video ${videoId}. ${message}`,
    tabHint
  );
}

/** Fetch YouTube captions via youtube-transcript (InnerTube + web fallback). */
export async function fetchYoutubeCaptions(
  urlOrId: string
): Promise<YoutubeCaptionResult> {
  const videoId = extractYoutubeVideoId(urlOrId);
  if (!videoId) {
    throw new YoutubeCaptionsUnavailableError(
      "Invalid YouTube URL.",
      "Paste a full youtube.com or youtu.be link."
    );
  }

  try {
    const items = await fetchTranscript(videoId, {
      lang: "en",
      fetch: browserFetch,
    });

    if (!items?.length) {
      throw new YoutubeCaptionsUnavailableError(
        "No caption lines returned for this video.",
        "Use tab capture if the video plays in your browser but has no published captions."
      );
    }

    const transcript = items
      .map((line) => line.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!transcript) {
      throw new YoutubeCaptionsUnavailableError(
        "Captions exist but returned empty text.",
        "Try tab capture for this video."
      );
    }

    const language = items.find((l) => l.lang)?.lang ?? "en";
    return { transcript, language };
  } catch (err) {
    if (err instanceof YoutubeCaptionsUnavailableError) throw err;
    throw mapTranscriptError(err, videoId);
  }
}
