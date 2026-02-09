export function getSafeNextPath(nextValue: string | null | undefined) {
  if (!nextValue) {
    return "/";
  }

  if (!nextValue.startsWith("/")) {
    return "/";
  }

  if (nextValue.startsWith("//")) {
    return "/";
  }

  return nextValue;
}

export function buildAuthHref(path: "/auth/sign-in" | "/auth/sign-up", nextPath: string) {
  const params = new URLSearchParams();
  params.set("next", getSafeNextPath(nextPath));
  return `${path}?${params.toString()}`;
}
