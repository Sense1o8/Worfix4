/**
 * WORFIX mission agent — server side (runs as a Netlify Function / Next.js route handler).
 *
 * The Gemini key is read from the GEMINI_API_KEY environment variable and never reaches the browser.
 * Set it in Netlify → Site configuration → Environment variables (and in web/.env.local for local dev).
 */
import { NextResponse } from "next/server";
import { aiMissionSchema, aiRequestSchema, GEMINI_RESPONSE_SCHEMA, type AiPlan } from "@/lib/ai/missions";
import { CATEGORIES } from "@/lib/domain/types";
import { fieldErrors } from "@/lib/domain/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tried in order until one exists for this key. Override with GEMINI_MODEL.
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash", "gemini-2.5-flash"].filter(Boolean) as string[];

// Best-effort per-instance rate limit (each serverless instance keeps its own window).
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 6;
}

const SYSTEM = `You are the WORFIX mission agent. WORFIX is a verified-volunteering platform: organizations publish missions,
volunteers attend in person and upload photo evidence, and reviewers approve it.
You design volunteering missions for ONE specific area. Rules:
- Ground every mission in the real geography, climate, season, culture and typical community needs of that area. Name real public places only if you are confident they exist there; otherwise describe the type of place and the district.
- Missions must be safe, legal, free to attend, suitable for volunteers aged 15+, doable in one session, and provable with photos.
- No fundraising, no political or religious campaigning, no medical tasks, no work that needs a licence, nothing near traffic or deep water without supervision.
- Make the missions different from each other (different causes, sizes and difficulty).
- Write in clear English. Do not invent statistics. Do not mention that you are an AI.
- Allowed causes: ${CATEGORIES.join(", ")}.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "The AI agent is not configured: set GEMINI_API_KEY on the server." }, { status: 503 });

  const ip = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

  const parsed = aiRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid request." }, { status: 400 });
  const r = parsed.data;

  const prompt = [
    `Area: ${r.area}`,
    r.lat != null && r.lng != null ? `Approximate coordinates: ${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}` : "",
    `Today's date: ${new Date().toISOString().slice(0, 10)} (plan for the coming 2-4 weeks, so mind the season).`,
    r.organization ? `Organization that will run the missions: ${r.organization}` : "",
    r.causes.length ? `Preferred causes: ${r.causes.join(", ")}` : "Preferred causes: any — choose what the area needs most.",
    r.notes ? `Extra guidance from the organizer: """${r.notes}"""` : "",
    `Propose exactly ${r.count} missions for this area.`,
  ].filter(Boolean).join("\n");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: GEMINI_RESPONSE_SCHEMA, temperature: 0.8 },
  });

  let lastError = "The AI service did not answer. Try again in a moment.";
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body, signal: AbortSignal.timeout(24_000),
      });
    } catch {
      // No point trying another model name: the function's own time limit is close.
      return NextResponse.json({ error: "The AI service took too long to answer. Try again, or ask for fewer missions." }, { status: 504 });
    }
    if (res.status === 404) continue; // model name not available for this key — try the next one
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string; status?: string };
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    } | null;
    if (!res.ok) {
      console.error("[ai/missions] Gemini error", res.status, json?.error?.message);
      if (res.status === 429) return NextResponse.json({ error: "The Gemini quota for this key is used up for now. Try again later." }, { status: 429 });
      if (res.status === 400 && /not found|not supported/i.test(json?.error?.message ?? "")) continue;
      if (res.status === 400 || res.status === 401 || res.status === 403)
        return NextResponse.json({ error: "Gemini rejected the API key or request. Check GEMINI_API_KEY and that the Generative Language API is enabled for it." }, { status: 502 });
      lastError = "The AI service is having trouble. Try again in a moment.";
      continue;
    }
    const raw = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      const data = JSON.parse(raw) as { areaSummary?: unknown; missions?: unknown[] };
      const missions = (Array.isArray(data.missions) ? data.missions : [])
        .map((m) => aiMissionSchema.safeParse(m))
        .flatMap((p) => (p.success && p.data.title.length >= 5 && p.data.description.length >= 30 && p.data.safety.length >= 10 ? [p.data] : []))
        .slice(0, r.count);
      if (!missions.length) throw new Error("no usable missions");
      const plan: AiPlan = { areaSummary: String(data.areaSummary ?? "").slice(0, 600), missions, model };
      return NextResponse.json(plan);
    } catch {
      lastError = "The agent's answer couldn't be read. Try again.";
    }
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
