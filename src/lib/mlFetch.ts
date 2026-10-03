export async function fetchMlWithBackoff(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, init);

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : 500 * Math.pow(2, attempt);

    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }

  return fetch(url, init);
}
