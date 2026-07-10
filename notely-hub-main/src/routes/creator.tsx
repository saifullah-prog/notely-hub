import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Mic, Square, Upload, Loader2, ArrowLeft, LogOut, Music2, Check, Trash2,
  Disc3, Send, ShieldCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useMySubmissions, readAudioDuration, COVER_KEYS, RIGHTS_LABEL,
  type Submission, type RightsKind,
} from "@/lib/creator";
import { coverByKey } from "@/lib/covers";

export const Route = createFileRoute("/creator")({
  head: () => ({ meta: [{ title: "Creator Studio — Rocky" }] }),
  component: CreatorStudio,
});

type CreatorTab = "create" | "mine";

function CreatorStudio() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<CreatorTab>("create");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const tabs: { id: CreatorTab; label: string; icon: typeof Mic }[] = [
    { id: "create", label: "New track", icon: Disc3 },
    { id: "mine", label: "My submissions", icon: Music2 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Disc3 className="size-5" />
          </span>
          Creator Studio
        </div>
        <div className="flex-1" />
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <ArrowLeft className="size-4" /> <span className="hidden sm:block">App</span>
        </Link>
        <button onClick={() => signOut()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <LogOut className="size-4" /> <span className="hidden sm:block">Log out</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 max-w-4xl w-full mx-auto">
        <nav className="md:w-52 shrink-0 flex md:flex-col gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                tab === t.id ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-elevated/60"
              }`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 min-w-0">
          {tab === "create" ? <NewTrack onSubmitted={() => setTab("mine")} /> : <MySubmissions />}
        </main>
      </div>
    </div>
  );
}

/* ── New track: record or upload, add details, submit for approval ── */

function NewTrack({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const defaultArtist = (user?.email ?? "").split("@")[0] || "Me";
  const [form, setForm] = useState({
    title: "", artist: defaultArtist, album: "", duration: "", cover_key: "album1", note: "",
  });
  const [rights, setRights] = useState<RightsKind>("original");
  const [ownsRights, setOwnsRights] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof MediaRecorder !== "undefined";

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function useAudio(next: Blob, name: string) {
    setBlob(next);
    setSourceName(name);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(next));
    const dur = await readAudioDuration(next);
    if (dur) setForm((f) => ({ ...f, duration: dur }));
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await useAudio(b, "recording");
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone. Check browser permissions, or upload a file instead.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void useAudio(f, f.name);
  }

  function extFor(b: Blob, name: string): string {
    const fromName = name.includes(".") ? name.split(".").pop()! : "";
    if (fromName) return fromName.toLowerCase();
    const t = b.type;
    if (t.includes("webm")) return "webm";
    if (t.includes("mp4") || t.includes("m4a")) return "m4a";
    if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
    if (t.includes("ogg")) return "ogg";
    if (t.includes("wav")) return "wav";
    return "webm";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!user) return;
    if (!blob) return setError("Record or upload an audio file first.");
    if (!form.title.trim() || !form.artist.trim() || !form.album.trim()) {
      return setError("Title, artist and album are required.");
    }
    const duration = form.duration.trim() || "0:00";
    if (!/^\d{1,2}:\d{2}$/.test(duration)) return setError("Duration must look like 3:42.");
    if (!ownsRights) return setError("Please confirm you own or have the rights to distribute this audio.");

    setBusy(true);
    const path = `submissions/${user.id}/${crypto.randomUUID()}.${extFor(blob, sourceName)}`;
    const up = await supabase.storage.from("audio").upload(path, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });
    if (up.error) {
      setBusy(false);
      return setError(`Upload failed: ${up.error.message}`);
    }
    const ins = await supabase.from("submissions").insert({
      user_id: user.id,
      title: form.title.trim(),
      artist: form.artist.trim(),
      album: form.album.trim(),
      duration,
      cover_key: form.cover_key,
      audio_path: path,
      note: form.note.trim() || null,
      rights,
      owns_rights: ownsRights,
    });
    setBusy(false);
    if (ins.error) return setError(ins.error.message);

    setNotice("Submitted! An admin will review it for publishing.");
    setForm({ title: "", artist: defaultArtist, album: "", duration: "", cover_key: "album1", note: "" });
    setRights("original");
    setOwnsRights(false);
    setBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSourceName("");
    qc.invalidateQueries({ queryKey: ["my-submissions"] });
    qc.invalidateQueries({ queryKey: ["submissions"] });
    setTimeout(onSubmitted, 900);
  }

  const field = "w-full rounded-md bg-elevated border border-input focus:border-primary px-3 py-2 text-sm outline-none transition";

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Create a track</h1>
        <p className="text-sm text-muted-foreground">Record or upload your music, add the details, and send it to the team for approval.</p>
      </div>

      {/* Record / upload */}
      <div className="rounded-lg border border-border bg-card/40 p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Mic className="size-4" /> Audio</h2>
        <div className="flex flex-wrap items-center gap-3">
          {canRecord && (
            recording ? (
              <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-destructive text-destructive-foreground font-semibold">
                <Square className="size-4 fill-current" /> Stop recording
              </button>
            ) : (
              <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold">
                <Mic className="size-4" /> Record
              </button>
            )
          )}
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-elevated hover:bg-secondary font-semibold cursor-pointer">
            <Upload className="size-4" /> Upload file
            <input type="file" accept="audio/*" onChange={onFile} className="hidden" />
          </label>
          {recording && <span className="text-sm text-destructive flex items-center gap-2"><span className="size-2 rounded-full bg-destructive animate-pulse" /> Recording…</span>}
          {sourceName && !recording && <span className="text-sm text-muted-foreground truncate">Loaded: {sourceName}</span>}
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full mt-2" />}
        {!canRecord && <p className="text-xs text-muted-foreground">In-browser recording isn't available here — upload an audio file instead.</p>}
      </div>

      {/* Details */}
      <div className="rounded-lg border border-border bg-card/40 p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Disc3 className="size-4" /> Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm"><span className="font-medium">Title</span>
            <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="My new song" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Artist</span>
            <input className={field} value={form.artist} onChange={(e) => set("artist", e.target.value)} placeholder="Your artist name" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Album</span>
            <input className={field} value={form.album} onChange={(e) => set("album", e.target.value)} placeholder="My album" />
            <span className="text-xs text-muted-foreground">Tip: use the same album name across tracks to group them.</span>
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Duration (m:ss)</span>
            <input className={field} value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="3:42" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Cover</span>
            <select className={field} value={form.cover_key} onChange={(e) => set("cover_key", e.target.value)}>
              {COVER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Note to reviewer (optional)</span>
            <input className={field} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Anything the admin should know" />
          </label>
        </div>
      </div>

      {/* Rights & copyright */}
      <div className="rounded-lg border border-border bg-card/40 p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="size-4" /> Rights &amp; copyright</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-1">This track is:</legend>
          {(Object.keys(RIGHTS_LABEL) as RightsKind[]).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="rights" value={r} checked={rights === r} onChange={() => setRights(r)} className="accent-primary" />
              {RIGHTS_LABEL[r]}
            </label>
          ))}
        </fieldset>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={ownsRights} onChange={(e) => setOwnsRights(e.target.checked)} className="mt-0.5 accent-primary" />
          <span>I confirm I own or have the rights to distribute this audio, and it doesn't infringe anyone's copyright.</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Your declaration is shown to the reviewer. Submitting content you don't have rights to may get it rejected and your account restricted.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-primary flex items-center gap-1"><Check className="size-4" /> {notice}</p>}

      <button type="submit" disabled={busy || !ownsRights} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit for approval
      </button>
    </form>
  );
}

/* ── My submissions list ─────────────────────────────────── */

const STATUS_STYLE: Record<Submission["status"], string> = {
  pending: "bg-yellow-500/15 text-yellow-500",
  approved: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
};

function MySubmissions() {
  const qc = useQueryClient();
  const { data: subs = [], isLoading } = useMySubmissions();

  async function remove(s: Submission) {
    if (s.status !== "pending") return;
    if (!confirm(`Withdraw "${s.title}"?`)) return;
    await supabase.from("submissions").delete().eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["my-submissions"] });
    qc.invalidateQueries({ queryKey: ["submissions"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">My submissions</h1>
        <p className="text-sm text-muted-foreground">Track the approval status of everything you've submitted.</p>
      </div>

      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : subs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          <Disc3 className="size-8 mx-auto mb-2 opacity-60" />
          You haven't submitted anything yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {subs.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={coverByKey[s.cover_key] ?? coverByKey.album1} alt="" width={40} height={40} className="size-10 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.artist} • {s.album} • {s.duration}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                {s.status === "pending" && (
                  <button onClick={() => remove(s)} aria-label="Withdraw" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              {s.status === "rejected" && s.rejection_reason && (
                <p className="mt-2 ml-13 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {s.rejection_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" /> Approved tracks appear in the app's catalog for everyone.
      </p>
    </div>
  );
}
