/** Opaque, sortable-ish IDs: <prefix>_<time36><random>. Never derived from user data. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, "0");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${prefix}_${time}${random}`;
}
export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => new Date().toISOString().slice(0, 7);
