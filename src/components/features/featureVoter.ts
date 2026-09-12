const STORAGE_KEY = "dg.featureVoter";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable anonymous voter key for this browser (`a:<id>`). */
export function getOrCreateAnonVoterKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
      return `a:${existing}`;
    }
    const id = randomId().slice(0, 32);
    localStorage.setItem(STORAGE_KEY, id);
    return `a:${id}`;
  } catch {
    return `a:${randomId().slice(0, 32)}`;
  }
}
