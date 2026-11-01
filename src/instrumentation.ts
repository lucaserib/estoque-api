export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export async function extrairContaId(headers: NodeJS.Dict<string | string[]>): Promise<string | null> {
  const segredo = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!segredo) return null;

  const cookieHeader = headers.cookie;
  const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!cookieString) return null;

  const nomesPossiveis = ["__Secure-next-auth.session-token", "next-auth.session-token"];
  for (const nome of nomesPossiveis) {
    const match = cookieString.match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`));
    if (!match) continue;
    try {
      const { decode } = await import("next-auth/jwt");
      const token = await decode({ token: decodeURIComponent(match[1]), secret: segredo });
      if (token?.contaId) return token.contaId as string;
      if (token?.id) return token.id as string;
    } catch {
      return null;
    }
  }
  return null;
}

export async function onRequestError(
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
) {
  if (!process.env.SENTRY_DSN) return;
  const { captureRequestError, setTag } = await import("@sentry/nextjs");
  const [, errorRequest] = args;
  const contaId = await extrairContaId(errorRequest.headers).catch(() => null);
  if (contaId) setTag("contaId", contaId);
  captureRequestError(...args);
}
