const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export function tokenFromCheckinQr(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const token = (new URLSearchParams(url.hash.slice(1)).get("t") ?? url.searchParams.get("t"))?.trim() ?? "";

    if (!['http:', 'https:'].includes(url.protocol) || path !== "/checkin" || !TOKEN_PATTERN.test(token)) {
      return null;
    }

    return token;
  } catch {
    return null;
  }
}
