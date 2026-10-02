let latestAuthUrl: string | null = null;

export function captureAuthUrl(url: string | null | undefined) {
  if (!url) return;
  if (!url.includes('auth-callback')) return;
  latestAuthUrl = url;
}

export function peekCapturedAuthUrl() {
  return latestAuthUrl;
}

export function consumeCapturedAuthUrl() {
  const url = latestAuthUrl;
  latestAuthUrl = null;
  return url;
}
