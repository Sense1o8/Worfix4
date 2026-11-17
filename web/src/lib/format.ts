import type { Category, Difficulty, MissionStatus, VerificationStatus } from "./domain/types";

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtDuration = (min: number) => (min < 60 ? `${min} min` : `${Math.round((min / 60) * 10) / 10} h`);
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const CATEGORY_LABEL: Record<Category, string> = {
  environment: "Environment", community: "Community", animals: "Animals", education: "Education", water: "Water", recycling: "Recycling",
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Challenging" };
export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  draft: "Draft", pending_review: "In review", published: "Published", closed: "Closed", cancelled: "Cancelled",
};
export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  pending: "Pending review", approved: "Approved", rejected: "Rejected", needs_more_info: "Needs more info",
};
export const VERIFICATION_TONE: Record<VerificationStatus, "warning" | "success" | "danger" | "info"> = {
  pending: "warning", approved: "success", rejected: "danger", needs_more_info: "info",
};
