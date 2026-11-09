import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

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

function limiteNoBancoAtivo(): boolean {
  const configurado = process.env.RATE_LIMIT_BANCO?.trim();
  if (configurado === "1") return true;
  if (configurado === "0") return false;
  return process.env.NODE_ENV === "production";
}

async function contarNoBanco(
  name: string,
  identifier: string,
  requests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const janelaMs = windowSeconds * 1000;
  const janela = Math.floor(Date.now() / janelaMs);
  const resetAt = (janela + 1) * janelaMs;
  const chave = `${name}:${identifier.toLowerCase()}:${janela}`.slice(0, 500);
  try {
    const [linha] = await prisma.$queryRaw<Array<{ contagem: number }>>`
      INSERT INTO "contadores_limite" ("chave", "contagem", "expiraEm")
      VALUES (${chave}, 1, ${new Date(resetAt)})
      ON CONFLICT ("chave") DO UPDATE SET "contagem" = "contadores_limite"."contagem" + 1
      RETURNING "contagem"`;
    const contagem = Number(linha?.contagem ?? 1);
    return { allowed: contagem <= requests, remaining: Math.max(0, requests - contagem), resetAt };
  } catch (error) {
    console.error("[RATE_LIMIT] Falha ao contar no banco; liberando a requisição:", error);
    return { allowed: true, remaining: requests, resetAt };
  }
}

export async function limparContadoresVencidos(agora: Date = new Date()): Promise<number> {
  const { count } = await prisma.contadorLimite.deleteMany({ where: { expiraEm: { lt: agora } } });
  return count;
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
    if (limiteNoBancoAtivo()) return contarNoBanco(name, identifier, requests, windowSeconds);
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
