import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const REQUESTS_PER_SECOND = 3;
const MIN_INTERVAL_MS = 1000 / REQUESTS_PER_SECOND;

const upstashLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(REQUESTS_PER_SECOND, "1 s", REQUESTS_PER_SECOND),
      prefix: "ratelimit:bling-api",
    })
  : null;

const memoryQueues = new Map<string, Promise<void>>();
const memoryLastCallAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitInMemory(accountId: string): Promise<void> {
  const previous = memoryQueues.get(accountId) ?? Promise.resolve();

  const turn = previous.then(async () => {
    const lastCallAt = memoryLastCallAt.get(accountId) ?? 0;
    const elapsed = Date.now() - lastCallAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    memoryLastCallAt.set(accountId, Date.now());
  });

  memoryQueues.set(accountId, turn);
  await turn;
}

export async function throttleBlingRequest(accountId: string): Promise<void> {
  if (upstashLimiter) {
    for (;;) {
      const result = await upstashLimiter.limit(accountId);
      if (result.success) return;
      await sleep(Math.max(50, result.reset - Date.now()));
    }
  }

  await waitInMemory(accountId);
}
