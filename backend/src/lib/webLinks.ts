/** An absolute http(s) address, e.g. a legal act in ConsultantPlus or a page of Rospatent. */
export function isWebLink(value: unknown): value is string {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
