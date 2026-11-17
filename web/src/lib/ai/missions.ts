import { z } from "zod";
import { CATEGORIES, DIFFICULTIES } from "../domain/types";

/** Request the browser sends to /api/ai/missions. */
export const aiRequestSchema = z.object({
  area: z.string().trim().min(3, "Tell the agent which area to plan for.").max(160),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  causes: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length).default([]),
  notes: z.string().trim().max(400).default(""),
  organization: z.string().trim().max(120).default(""),
  count: z.number().int().min(1).max(6).default(4),
});
export type AiRequest = z.input<typeof aiRequestSchema>;

const text = (max: number) => z.string().trim().transform((s) => s.slice(0, max));

/** One mission draft proposed by the agent — already clamped to what the mission form accepts. */
export const aiMissionSchema = z.object({
  title: text(100),
  description: text(2000),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  durationMinutes: z.number().transform((n) => Math.min(720, Math.max(15, Math.round(n / 15) * 15))),
  capacity: z.number().transform((n) => Math.min(500, Math.max(1, Math.round(n)))),
  location: text(160),
  safety: text(600),
  requirements: text(600),
  equipment: text(400),
  impactLabel: text(60),
  impactAmount: z.number().transform((n) => Math.min(10_000, Math.max(0, Math.round(n * 10) / 10))),
  whyHere: text(300),
});
export type AiMission = z.output<typeof aiMissionSchema>;

export interface AiPlan { areaSummary: string; missions: AiMission[]; model: string }

/** Response schema handed to Gemini (OpenAPI subset) so the answer is always parseable JSON. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    areaSummary: { type: "STRING", description: "2-3 sentences on what this area needs from volunteers and why." },
    missions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "5-80 characters, concrete and local." },
          description: { type: "STRING", description: "80-600 characters: what volunteers do, step by step, and why it matters here." },
          category: { type: "STRING", enum: [...CATEGORIES] },
          difficulty: { type: "STRING", enum: [...DIFFICULTIES] },
          durationMinutes: { type: "INTEGER", description: "30-360" },
          capacity: { type: "INTEGER", description: "Number of volunteers, 5-60" },
          location: { type: "STRING", description: "A real, specific public place in the area (park, riverbank, district, school...) followed by the city." },
          safety: { type: "STRING", description: "Safety instructions specific to this activity and the local climate/season." },
          requirements: { type: "STRING", description: "What volunteers must bring or be able to do." },
          equipment: { type: "STRING", description: "What the organizer provides." },
          impactLabel: { type: "STRING", description: "Countable unit in lowercase plural, e.g. 'trees planted', 'kg of litter collected'." },
          impactAmount: { type: "NUMBER", description: "Realistic amount of that unit ONE volunteer achieves." },
          whyHere: { type: "STRING", description: "One sentence: why this mission fits this exact area." },
        },
        required: ["title", "description", "category", "difficulty", "durationMinutes", "capacity", "location", "safety", "requirements", "equipment", "impactLabel", "impactAmount", "whyHere"],
      },
    },
  },
  required: ["areaSummary", "missions"],
} as const;
