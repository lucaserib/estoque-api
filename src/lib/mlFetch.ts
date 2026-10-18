const TEMPO_LIMITE_PADRAO_MS = 15000;
const ESPERA_MAXIMA_MS = 5000;

export async function fetchMlWithBackoff(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const comTempoLimite = (): RequestInit =>
    init.signal ? init : { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_PADRAO_MS) };

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, comTempoLimite());

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : 500 * Math.pow(2, attempt);

    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterMs, ESPERA_MAXIMA_MS)));
  }

  return fetch(url, comTempoLimite());
}
