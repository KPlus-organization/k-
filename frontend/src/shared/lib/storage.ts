// Only non-sensitive prototype state is stored. Passwords are never persisted.
export function readStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(`moe-pravo:${key}`) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(`moe-pravo:${key}`, JSON.stringify(value));
  } catch {
    /* The app also works without browser storage. */
  }
}
export function removeStored(key: string) {
  try {
    localStorage.removeItem(`moe-pravo:${key}`);
  } catch {
    /* The app also works without browser storage. */
  }
}
