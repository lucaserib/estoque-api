import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, requests: number, windowSeconds: number): Ratelimit | null {
  if (!redis) return null;

  const key = `${name}:${requests}:${windowSeconds}`;
  const existing = limiters.get(key);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    prefix: `ratelimit:${name}`,
  });
  limiters.set(key, limiter);
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  name: string,
  identifier: string,
  requests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const limiter = getLimiter(name, requests, windowSeconds);

  if (!limiter) {
    return {
      allowed: true,
      remaining: requests,
      resetAt: Date.now() + windowSeconds * 1000,
    };
  }

  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000)
  );

  return NextResponse.json(
    {
      error: "Muitas solicitações. Tente novamente em instantes.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
