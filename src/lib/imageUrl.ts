export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  let normalized = url.trim();
  if (!normalized) return null;

  normalized = normalized.replace(/^https?:\/\/https?:\/\//, "https://");

  if (!/^https?:\/\//.test(normalized)) {
    if (normalized.startsWith("//")) {
      normalized = `https:${normalized}`;
    } else if (normalized.includes(".")) {
      normalized = `https://${normalized}`;
    } else {
      return null;
    }
  }

  if (normalized.startsWith("http://")) {
    normalized = `https://${normalized.slice("http://".length)}`;
  }

  return normalized;
}

export function pickMlImageUrl(item: {
  secure_thumbnail?: string | null;
  thumbnail?: string | null;
  pictures?: Array<{ secure_url?: string | null }> | null;
}): string | null {
  return (
    normalizeImageUrl(item.secure_thumbnail) ??
    normalizeImageUrl(item.pictures?.[0]?.secure_url) ??
    normalizeImageUrl(item.thumbnail)
  );
}
