import { canReviewSubmission, DomainError } from "./permissions";
import { computeGrant, dayKey, levelForXp, nextStreak } from "./rewards";
import { makeVerificationCode } from "./certificates";
import type {
  AuditLog,
  Certificate,
  Mission,
  Notification,
  Organization,
  Submission,
  UserProfile,
  VerificationRecord,
  VerificationStatus,
} from "./types";

/** Allowed transitions. approved/rejected are final; needs_more_info returns to pending on resubmission. */
const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  pending: ["approved", "rejected", "needs_more_info"],
  needs_more_info: ["pending"],
  approved: [],
  rejected: [],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus) {
  return TRANSITIONS[from].includes(to);
}

export type ReviewDecision = "approved" | "rejected" | "needs_more_info";

export interface ReviewInput {
  submission: Submission;
  mission: Mission;
  volunteer: UserProfile;
  reviewer: UserProfile;
  organization: Organization | null;
  decision: ReviewDecision;
  note: string;
  now: string;
  newId: () => string;
  origin: string;
}

export interface ReviewResult {
  submission: Submission;
  volunteer: UserProfile;
  record: VerificationRecord;
  certificate: Certificate | null;
  notifications: Notification[];
  audit: AuditLog;
}

/**
 * Pure review decision. Runs on the server (Cloud Function) in production and in the
 * local dev store — the same code path, so rules cannot drift between them.
 * Rewards are granted only on approval, and exactly once per submission.
 */
export function reviewSubmission(input: ReviewInput): ReviewResult {
  const { submission, mission, volunteer, reviewer, organization, decision, now } = input;
  const note = input.note.trim();

  if (!canReviewSubmission(reviewer, submission, organization)) {
    throw new DomainError("forbidden", "You are not allowed to review this submission.");
  }
  if (!canTransition(submission.verificationStatus, decision)) {
    throw new DomainError(
      "invalid_state",
      `A ${submission.verificationStatus.replace(/_/g, " ")} submission cannot become ${decision.replace(/_/g, " ")}.`,
    );
  }
  if (decision !== "approved" && note.length < 5) {
    throw new DomainError("validation", "Add a short explanation so the volunteer knows what to do next.");
  }
  if (decision === "approved" && submission.rewardGrantedAt) {
    throw new DomainError("conflict", "Rewards for this submission were already granted.");
  }

  const updatedSubmission: Submission = {
    ...submission,
    verificationStatus: decision,
    reviewedBy: reviewer.id,
    reviewedAt: now,
    reviewNote: note,
  };

  let updatedVolunteer = volunteer;
  let certificate: Certificate | null = null;
  const notifications: Notification[] = [];

  if (decision === "approved") {
    const grant = computeGrant(mission, volunteer);
    const xp = volunteer.xp + grant.xp;
    const impact = { ...volunteer.impact };
    for (const [label, amount] of Object.entries(grant.impact)) impact[label] = (impact[label] ?? 0) + amount;
    const today = dayKey(now);
    const code = makeVerificationCode();
    certificate = {
      id: input.newId(),
      userId: volunteer.id,
      missionId: mission.id,
      organizationId: mission.organizationId,
      certificateType: "mission",
      qrCode: `${input.origin}/verify/${code}`,
      verificationCode: code,
      issuedAt: now,
      pdfUrl: null,
      holderName: volunteer.fullName,
      missionTitle: mission.title,
      organizationName: organization?.name ?? "WORFIX",
      hours: grant.hours,
      xp: grant.xp,
    };
    updatedVolunteer = {
      ...volunteer,
      xp,
      level: levelForXp(xp),
      points: volunteer.points + grant.points,
      totalVolunteerHours: Math.round((volunteer.totalVolunteerHours + grant.hours) * 100) / 100,
      impact,
      totalImpact: Object.values(impact).reduce((a, b) => a + b, 0),
      streak: nextStreak(volunteer.streak, volunteer.lastApprovedDay, today),
      lastApprovedDay: today,
      updatedAt: now,
    };
    updatedSubmission.rewardGrantedAt = now;
    updatedSubmission.certificateId = certificate.id;
    notifications.push({
      id: input.newId(),
      userId: volunteer.id,
      type: "reward",
      title: "Mission verified",
      message: `"${mission.title}" was approved: +${grant.xp} XP, +${grant.points} points, and a certificate.`,
      link: "/app/certificates",
      read: false,
      createdAt: now,
    });
  } else {
    notifications.push({
      id: input.newId(),
      userId: volunteer.id,
      type: "submission",
      title: decision === "rejected" ? "Submission not approved" : "More information needed",
      message: `"${mission.title}": ${note}`,
      link: `/app/missions/${mission.id}`,
      read: false,
      createdAt: now,
    });
  }

  const record: VerificationRecord = {
    id: input.newId(),
    submissionId: submission.id,
    reviewerId: reviewer.id,
    reviewerRole: reviewer.role,
    decision,
    note,
    createdAt: now,
  };
  const audit: AuditLog = {
    id: input.newId(),
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: `submission.${decision}`,
    resource: "missionSubmissions",
    resourceId: submission.id,
    timestamp: now,
    detail: `${mission.title} / volunteer ${volunteer.username}`,
    ipAddress: null,
    device: null,
  };

  return { submission: updatedSubmission, volunteer: updatedVolunteer, record, certificate, notifications, audit };
}

/** Volunteer adds evidence after a "needs more info" request: goes back to the queue. */
export function resubmit(submission: Submission, additions: Pick<Submission, "images" | "notes">, now: string): Submission {
  if (!canTransition(submission.verificationStatus, "pending")) {
    throw new DomainError("invalid_state", "This submission is not waiting for more information.");
  }
  return {
    ...submission,
    images: [...submission.images, ...additions.images],
    notes: additions.notes ? `${submission.notes}\n\n[Update ${now.slice(0, 10)}] ${additions.notes}`.trim() : submission.notes,
    verificationStatus: "pending",
    timestamp: now,
    metadata: { ...submission.metadata, submissionCount: submission.metadata.submissionCount + 1 },
  };
}
