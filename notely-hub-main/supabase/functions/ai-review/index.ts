// Supabase Edge Function: ai-review
// Deep AI examination of creator submissions — transcribes the audio (Whisper)
// then has Claude judge vulgarity + likely copyright from the lyrics + metadata,
// and when warranted rejects the submission with a generated reason.
//
// Deploy:   supabase functions deploy ai-review
// Secrets:  supabase secrets set ANTHROPIC_API_KEY=... TRANSCRIBE_KEY=... CRON_SECRET=...
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
//
// Invoke:   from the admin UI via supabase.functions.invoke("ai-review", { body })
//           or from pg_cron via net.http_post with an x-cron-secret header.
//   body: {}                        → review submissions pending > 10 days
//         { all_pending: true }     → review every pending submission
//         { submission_id: "uuid" } → review one submission

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Transcription (OpenAI Whisper by default; Groq works by overriding URL+model).
const TRANSCRIBE_URL = Deno.env.get("TRANSCRIBE_URL") ?? "https://api.openai.com/v1/audio/transcriptions";
const TRANSCRIBE_KEY = Deno.env.get("TRANSCRIBE_KEY");
const TRANSCRIBE_MODEL = Deno.env.get("TRANSCRIBE_MODEL") ?? "whisper-1";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    await authorize(req);
    const body = await req.json().catch(() => ({}));
    const subs = await selectSubmissions(body);
    const results = [];
    for (const s of subs) results.push(await review(s));
    return json({ reviewed: results.length, results });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: e instanceof Error ? e.message : String(e) }, status);
  }
});

async function authorize(req: Request) {
  // Scheduled/cron path.
  if (CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET) return;
  // Admin path — verify the caller's JWT and admin flag.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Missing authorization");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "Invalid token");
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) throw new HttpError(403, "Admins only");
}

async function selectSubmissions(body: Record<string, unknown>) {
  if (typeof body.submission_id === "string") {
    const { data } = await admin.from("submissions").select("*").eq("id", body.submission_id).limit(1);
    return data ?? [];
  }
  let q = admin.from("submissions").select("*").eq("status", "pending");
  if (!body.all_pending) {
    const cutoff = new Date(Date.now() - 10 * 86_400_000).toISOString();
    q = q.lt("created_at", cutoff);
  }
  const { data } = await q.order("created_at", { ascending: true }).limit(20);
  return data ?? [];
}

type Verdict = { reject: boolean; reason: string; categories: string[] };

async function review(s: Record<string, any>) {
  const publicUrl = s.audio_path
    ? `${SUPABASE_URL}/storage/v1/object/public/audio/${s.audio_path}`
    : null;

  const lyrics = await transcribe(publicUrl);
  const verdict = await judge(s, lyrics);
  const notes = buildNotes(lyrics, verdict);

  const patch: Record<string, unknown> = { ai_reviewed_at: new Date().toISOString(), ai_notes: notes };
  if (verdict.reject) {
    patch.status = "rejected";
    patch.reviewed_at = new Date().toISOString();
    patch.rejection_reason = "Automated AI review: " + verdict.reason;
  }
  await admin.from("submissions").update(patch).eq("id", s.id);

  return { id: s.id, title: s.title, reject: verdict.reject, categories: verdict.categories };
}

async function transcribe(url: string | null): Promise<string> {
  if (!url || !TRANSCRIBE_KEY) return "";
  try {
    const audio = await fetch(url);
    if (!audio.ok) return "";
    const blob = await audio.blob();
    const fd = new FormData();
    fd.append("file", blob, "audio");
    fd.append("model", TRANSCRIBE_MODEL);
    const r = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${TRANSCRIBE_KEY}` },
      body: fd,
    });
    if (!r.ok) return "";
    const j = await r.json();
    return String(j.text ?? "").slice(0, 6000);
  } catch {
    return "";
  }
}

async function judge(s: Record<string, any>, lyrics: string): Promise<Verdict> {
  if (!ANTHROPIC_API_KEY) return { reject: false, reason: "AI key not configured", categories: ["none"] };

  const evidence = {
    submitted: {
      title: s.title, artist: s.artist, album: s.album,
      declared_rights: s.rights, owns_rights: s.owns_rights, note: s.note,
    },
    transcribed_lyrics: lyrics || "(none / instrumental / transcription unavailable)",
  };

  const system =
    "You are a strict but fair content-moderation reviewer for a music streaming app. " +
    "Examine a user-submitted track and decide whether to REJECT it for either " +
    "(1) vulgarity: explicit profanity, slurs, hateful, or graphic sexual content unsuitable for a general catalog; or " +
    "(2) copyright: the lyrics or metadata clearly indicate an unlicensed cover, a reupload of a known copyrighted song, or that the submitter does not own the work. " +
    "Only reject when the evidence clearly supports it; when unsure, do not reject. " +
    "Write 'reason' as a short, polite explanation addressed to the creator, and set 'categories' to the applicable reasons (use [\"none\"] when not rejecting).";

  const requestBody = {
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            reject: { type: "boolean" },
            reason: { type: "string" },
            categories: { type: "array", items: { type: "string", enum: ["vulgarity", "copyright", "none"] } },
          },
          required: ["reject", "reason", "categories"],
          additionalProperties: false,
        },
      },
    },
    system,
    messages: [
      { role: "user", content: "Review this submission and return the JSON verdict.\n\n" + JSON.stringify(evidence, null, 2) },
    ],
  };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const j = await r.json();
  if (j.stop_reason === "refusal") return { reject: false, reason: "AI declined to review this submission", categories: ["none"] };
  const text = (j.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text) as Verdict;
    return { reject: !!parsed.reject, reason: parsed.reason ?? "", categories: parsed.categories ?? [] };
  } catch {
    return { reject: false, reason: "AI response could not be parsed", categories: ["none"] };
  }
}

function buildNotes(lyrics: string, verdict: Verdict): string {
  const parts: string[] = [];
  parts.push(`AI verdict: ${verdict.reject ? "REJECT" : "clean"}${verdict.categories?.length ? ` [${verdict.categories.join(", ")}]` : ""}.`);
  parts.push(lyrics ? `Lyrics transcribed (${lyrics.length} chars).` : "Lyrics: none/instrumental or transcription unavailable.");
  return parts.join(" ");
}
