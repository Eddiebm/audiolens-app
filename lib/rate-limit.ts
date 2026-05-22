import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return Redis.fromEnv();
}

const redis = getRedis();

/** 5 transcription requests per IP per hour */
export const transcribeRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "al:transcribe",
    })
  : null;

/** 20 analysis requests per IP per hour */
export const analyzeRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "al:analyze",
    })
  : null;

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function checkTranscribeLimit(
  request: Request
): Promise<NextResponse | null> {
  if (!transcribeRatelimit) return null;
  const ip = getClientIp(request);
  const { success } = await transcribeRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "You've hit the usage limit. Try again in an hour." },
      { status: 429 }
    );
  }
  return null;
}

export async function checkAnalyzeLimit(
  request: Request
): Promise<NextResponse | null> {
  if (!analyzeRatelimit) return null;
  const ip = getClientIp(request);
  const { success } = await analyzeRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "You've hit the usage limit. Try again in an hour." },
      { status: 429 }
    );
  }
  return null;
}
