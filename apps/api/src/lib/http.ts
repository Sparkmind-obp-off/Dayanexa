export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: unknown) {
    super(message ?? code);
  }
}
export const fail = (status: number, code: string, message?: string, details?: unknown): never => {
  throw new ApiError(status, code, message, details);
};
export const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== undefined && value !== "" ? parsed : fallback;
};
export const flag = (value: string | undefined): boolean => value === "true";
export const list = (value: string | undefined): string[] =>
  (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
