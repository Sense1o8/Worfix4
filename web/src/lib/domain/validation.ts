import { z } from "zod";
import { CATEGORIES, DIFFICULTIES } from "./types";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_IMAGE_EDGE = 320;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`)
    .max(max, `${label} can be at most ${max} characters.`);

/** Age rules, evaluated on their own so they are reported even when other fields are also invalid. */
export function ageErrors(birthYear: unknown, guardianConsent: unknown): Record<string, string> {
  const year = Number(birthYear);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) return {};
  const age = new Date().getFullYear() - year;
  if (age < 15) return { birthYear: "WORFIX is for people aged 15 and over." };
  if (age < 18 && guardianConsent !== true) return { guardianConsent: "Under 18: confirm a parent or guardian knows you are joining." };
  return {};
}

export const registerSchema = z
  .object({
    fullName: trimmed(2, 80, "Full name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Include at least one letter and one number."),
    accountType: z.enum(["volunteer", "organization"]),
    ageConfirmed: z.literal(true, { error: "Please confirm you are 15 or older." }),
    guardianConsent: z.boolean(),
    birthYear: z
      .number({ error: "Enter your year of birth, e.g. 2008." })
      .int("Enter your year of birth, e.g. 2008.")
      .min(1900, "Enter your year of birth, e.g. 2008.")
      .max(new Date().getFullYear(), "Enter your year of birth, e.g. 2008."),
  })
  .superRefine((v, ctx) => {
    for (const [path, message] of Object.entries(ageErrors(v.birthYear, v.guardianConsent))) ctx.addIssue({ code: "custom", path: [path], message });
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const profileSchema = z.object({
  fullName: trimmed(2, 80, "Full name"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "3–24 characters: lowercase letters, numbers, underscores."),
  bio: z.string().trim().max(280, "Bio can be at most 280 characters."),
  country: trimmed(2, 60, "Country"),
  province: z.string().trim().max(80, "Province can be at most 80 characters."),
  city: trimmed(2, 60, "City"),
  feedVisible: z.boolean(),
  languages: z.array(z.string().trim().min(1).max(40)).min(1, "Add at least one language.").max(10),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  interests: z.array(z.enum(CATEGORIES)).min(1, "Pick at least one cause you care about.").max(6),
});

export const missionSchema = z
  .object({
    title: trimmed(5, 100, "Title"),
    description: trimmed(30, 2000, "Description"),
    category: z.enum(CATEGORIES),
    difficulty: z.enum(DIFFICULTIES),
    location: trimmed(3, 160, "Location"),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), "Choose a valid start date and time."),
    deadline: z.string().refine((d) => !Number.isNaN(Date.parse(d)), "Choose a valid sign-up deadline."),
    duration: z.number().int().min(15, "At least 15 minutes.").max(720, "At most 12 hours."),
    capacity: z.number().int().min(1, "At least 1 volunteer.").max(10_000),
    requirements: trimmed(0, 600, "Requirements"),
    safety: trimmed(10, 600, "Safety instructions"),
    equipment: trimmed(0, 400, "Equipment"),
    impactLabel: trimmed(0, 60, "Impact label"),
    impactAmount: z.number().min(0).max(10_000),
  })
  .superRefine((v, ctx) => {
    if (Date.parse(v.deadline) > Date.parse(v.date))
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be before the mission starts." });
    if ((v.lat === null) !== (v.lng === null))
      ctx.addIssue({ code: "custom", path: ["lat"], message: "Provide both latitude and longitude, or neither." });
    if (v.impactLabel && v.impactAmount <= 0)
      ctx.addIssue({ code: "custom", path: ["impactAmount"], message: "Enter the amount per volunteer." });
  });

export const organizationSchema = z.object({
  name: trimmed(2, 120, "Organization name"),
  description: trimmed(30, 1200, "Description"),
  organizationType: trimmed(2, 60, "Type"),
  website: z.string().trim().max(200).refine((v) => v === "" || /^https?:\/\/.+\..+/.test(v), "Use a full URL starting with https://"),
  email: z.string().trim().toLowerCase().email("Enter a valid contact email."),
  phone: trimmed(0, 30, "Phone"),
  address: trimmed(3, 200, "Address"),
  country: trimmed(2, 60, "Country"),
  city: trimmed(2, 60, "City"),
});

export const submissionSchema = z.object({
  notes: z.string().trim().max(1000, "Notes can be at most 1000 characters."),
  gpsConsent: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type MissionInput = z.infer<typeof missionSchema>;
export type OrganizationInput = z.infer<typeof organizationSchema>;

/** Flatten a zod error into { field: message }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
