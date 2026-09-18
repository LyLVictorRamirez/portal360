const unsafePathPattern = /\\|%2f|%5c/i;

export function getSafeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || unsafePathPattern.test(value)) {
    return "/";
  }

  return value;
}

export function withReturnTo(path: string, returnTo: string): string {
  if (returnTo === "/") {
    return path;
  }

  const url = new URL(path, "https://portal-360.invalid");
  url.searchParams.set("returnTo", returnTo);

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getBrowserCallbackUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
