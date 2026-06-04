const USERNAME_ALLOWED = /^[a-z0-9_.]{2,32}$/;

export function normalizeProfileUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, "")
    .replace(/[_.]{2,}/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 32);
}

export function isValidProfileUsername(value: unknown): value is string {
  return typeof value === "string" && USERNAME_ALLOWED.test(value);
}

export function profileHandle(username?: string | null) {
  const normalized = normalizeProfileUsername(username);
  return normalized ? `@${normalized}` : "";
}
