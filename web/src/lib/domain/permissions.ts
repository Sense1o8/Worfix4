import type { Mission, Organization, Role, Submission, UserProfile } from "./types";

export class DomainError extends Error {
  constructor(
    public code:
      | "forbidden"
      | "not_found"
      | "invalid_state"
      | "validation"
      | "conflict"
      | "suspended"
      | "unverified_email",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const isAdmin = (role: Role) => role === "admin" || role === "super_admin";

/** Where each role lands after login. */
export function homeForRole(role: Role) {
  if (isAdmin(role)) return "/admin";
  if (role === "organization") return "/org";
  return "/app";
}

export type Area = "volunteer" | "organization" | "admin";

/** Each portal is for its own role; admins may also open the organization portal (read-only support). */
export function canEnterArea(role: Role, area: Area) {
  if (area === "admin") return isAdmin(role);
  if (area === "organization") return role === "organization" || isAdmin(role);
  return role === "volunteer" || role === "company"; // company: future CSR portal reuses volunteer features
}

export function assertActive(user: Pick<UserProfile, "status">) {
  if (user.status === "suspended") throw new DomainError("suspended", "This account is suspended.");
  if (user.status === "deleted") throw new DomainError("not_found", "Account not found.");
}

/** Who can review a submission: the owning organization (approved org) or any admin. Never the author. */
export function canReviewSubmission(
  reviewer: Pick<UserProfile, "id" | "role" | "organizationId" | "status">,
  submission: Pick<Submission, "userId" | "organizationId">,
  org: Pick<Organization, "verificationStatus"> | null,
) {
  if (reviewer.status !== "active") return false;
  if (reviewer.id === submission.userId) return false; // cannot approve own submission
  if (isAdmin(reviewer.role)) return true;
  return (
    reviewer.role === "organization" &&
    reviewer.organizationId === submission.organizationId &&
    org?.verificationStatus === "approved"
  );
}

export function canManageMission(
  user: Pick<UserProfile, "role" | "organizationId" | "status">,
  mission: Pick<Mission, "organizationId">,
) {
  if (user.status !== "active") return false;
  if (isAdmin(user.role)) return true;
  return user.role === "organization" && user.organizationId === mission.organizationId;
}
