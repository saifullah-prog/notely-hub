import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ShieldCheck, Music2, Users, UserCog, Loader2, Trash2, Plus,
  ArrowLeft, LogOut, Check, KeyRound, Mail, Inbox, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";

import { supabase, audioUrlFromPath } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useIsAdmin, useProfiles, type Profile } from "@/lib/admin";
import { useAllSubmissions, copyrightFlags, RIGHTS_LABEL, type Submission } from "@/lib/creator";
import { useSongs, type Track } from "@/lib/songs";
import { coverByKey } from "@/lib/covers";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Rocky" }] }),
  component: AdminPortal,
});

const COVER_KEYS = ["album1", "album2", "album3", "album4", "album5", "album6"] as const;
type AdminTab = "songs" | "submissions" | "users" | "account";

function AdminPortal() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: submissions = [] } = useAllSubmissions(Boolean(isAdmin));
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const [tab, setTab] = useState<AdminTab>("songs");

  // Not logged in → send to login.
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || (user && adminLoading)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
        <div className="max-w-md text-center">
          <ShieldCheck className="size-10 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Not authorized</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This area is for administrators only. Your account ({user.email}) doesn't have
            admin access.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold">
            <ArrowLeft className="size-4" /> Back to Rocky
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Music2; badge?: number }[] = [
    { id: "songs", label: "Songs", icon: Music2 },
    { id: "submissions", label: "Submissions", icon: Inbox, badge: pendingCount },
    { id: "users", label: "Users", icon: Users },
    { id: "account", label: "Account", icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <ShieldCheck className="size-5" />
          </span>
          Admin Portal
        </div>
        <div className="flex-1" />
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <ArrowLeft className="size-4" /> <span className="hidden sm:block">App</span>
        </Link>
        <button onClick={() => signOut()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <LogOut className="size-4" /> <span className="hidden sm:block">Log out</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 max-w-6xl w-full mx-auto">
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
              {t.badge ? (
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <main className="flex-1 min-w-0">
          {tab === "songs" && <SongsManager />}
          {tab === "submissions" && <SubmissionsManager />}
          {tab === "users" && <UsersManager />}
          {tab === "account" && <AccountSection />}
        </main>
      </div>
    </div>
  );
}

/* ── Songs manager ────────────────────────────────────────── */

const songSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  artist: z.string().trim().min(1, "Artist is required"),
  album: z.string().trim().min(1, "Album is required"),
  duration: z.string().trim().regex(/^\d{1,2}:\d{2}$/, "Duration must look like 3:42"),
  cover_key: z.enum(COVER_KEYS),
  audio_path: z.string().trim().optional().or(z.literal("")),
});

function SongsManager() {
  const qc = useQueryClient();
  const { data: songs = [] } = useSongs();
  const [form, setForm] = useState({
    title: "", artist: "", album: "", duration: "", cover_key: "album1", audio_path: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function addSong(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = songSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.from("songs").insert({
      title: parsed.data.title,
      artist: parsed.data.artist,
      album: parsed.data.album,
      duration: parsed.data.duration,
      cover_key: parsed.data.cover_key,
      audio_path: parsed.data.audio_path || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message.includes("duplicate") ? "That song already exists." : err.message);
      return;
    }
    setNotice(`Added "${parsed.data.title}".`);
    setForm({ title: "", artist: "", album: "", duration: "", cover_key: "album1", audio_path: "" });
    qc.invalidateQueries({ queryKey: ["songs"] });
  }

  async function deleteSong(t: Track) {
    if (!confirm(`Delete "${t.title}" by ${t.artist}?`)) return;
    const { error: err } = await supabase.from("songs").delete().eq("title", t.title).eq("artist", t.artist);
    if (err) {
      setError(err.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["songs"] });
  }

  const field = "w-full rounded-md bg-elevated border border-input focus:border-primary px-3 py-2 text-sm outline-none transition";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Songs</h1>
        <p className="text-sm text-muted-foreground">Add tracks to the catalog or remove them. Writes are restricted to admins by the database.</p>
      </div>

      <form onSubmit={addSong} className="rounded-lg border border-border bg-card/40 p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Plus className="size-4" /> Add a song</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm"><span className="font-medium">Title</span>
            <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Neon Peaks" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Artist</span>
            <input className={field} value={form.artist} onChange={(e) => set("artist", e.target.value)} placeholder="Aurora Wave" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Album</span>
            <input className={field} value={form.album} onChange={(e) => set("album", e.target.value)} placeholder="Neon Peaks" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Duration (m:ss)</span>
            <input className={field} value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="3:42" />
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Cover</span>
            <select className={field} value={form.cover_key} onChange={(e) => set("cover_key", e.target.value)}>
              {COVER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm"><span className="font-medium">Audio path (optional)</span>
            <input className={field} value={form.audio_path} onChange={(e) => set("audio_path", e.target.value)} placeholder="aurora-wave/neon-peaks.mp3" />
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-primary flex items-center gap-1"><Check className="size-4" /> {notice}</p>}
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add song
        </button>
      </form>

      <div>
        <h2 className="font-semibold mb-3">Catalog ({songs.length})</h2>
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {songs.map((t) => (
            <div key={t.title + t.artist} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/50">
              <img src={t.cover} alt="" width={40} height={40} className="size-10 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.artist} • {t.album}</div>
              </div>
              <span className="text-xs text-muted-foreground">{t.duration}</span>
              <button onClick={() => deleteSong(t)} aria-label="Delete" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Users manager ────────────────────────────────────────── */

function UsersManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profiles = [], isLoading, error } = useProfiles(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleAdmin(p: Profile) {
    setBusyId(p.id);
    const { error: err } = await supabase.from("profiles").update({ is_admin: !p.is_admin }).eq("id", p.id);
    setBusyId(null);
    if (!err) qc.invalidateQueries({ queryKey: ["profiles"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Users</h1>
        <p className="text-sm text-muted-foreground">Everyone who has signed up. Grant or revoke admin access.</p>
      </div>

      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : error ? (
        <p className="text-sm text-destructive">Couldn't load users.</p>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-elevated/50">
              <span className="size-9 rounded-full bg-elevated grid place-items-center font-bold uppercase text-sm">
                {(p.email ?? "?").charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.email ?? "(no email)"}</div>
                <div className="text-xs text-muted-foreground">Joined {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
              {p.is_admin && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/15 text-primary">Admin</span>}
              <button
                onClick={() => toggleAdmin(p)}
                disabled={busyId === p.id || p.id === user?.id}
                title={p.id === user?.id ? "You can't change your own role here" : ""}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-elevated hover:bg-secondary disabled:opacity-50"
              >
                {busyId === p.id ? "…" : p.is_admin ? "Revoke admin" : "Make admin"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Note: fully deleting or banning a user requires the service_role key and a server function — not done
        from the browser for security. Removing admin access is safe and immediate.
      </p>
    </div>
  );
}

/* ── Submissions review ───────────────────────────────────── */

function SubmissionsManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: subs = [], isLoading, error } = useAllSubmissions(true);
  const { data: songs = [] } = useSongs();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = subs.filter((s) => s.status === "pending");
  const reviewed = subs.filter((s) => s.status !== "pending");

  async function approve(s: Submission) {
    const flags = copyrightFlags(s, songs);
    if (
      flags.some((f) => f.level === "high") &&
      !confirm("This submission has HIGH copyright warnings. Approve and publish it anyway?")
    ) {
      return;
    }
    setBusyId(s.id);
    // Publish the track into the public catalog.
    const ins = await supabase.from("songs").insert({
      title: s.title, artist: s.artist, album: s.album, duration: s.duration,
      cover_key: s.cover_key, audio_path: s.audio_path,
    });
    if (!ins.error || ins.error.message.includes("duplicate")) {
      await supabase.from("submissions")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
        .eq("id", s.id);
      qc.invalidateQueries({ queryKey: ["songs"] });
      qc.invalidateQueries({ queryKey: ["submissions"] });
    }
    setBusyId(null);
  }

  async function reject(s: Submission) {
    setBusyId(s.id);
    await supabase.from("submissions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
      .eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["submissions"] });
    setBusyId(null);
  }

  function Card({ s }: { s: Submission }) {
    const url = audioUrlFromPath(s.audio_path);
    const flags = copyrightFlags(s, songs);
    const hasHigh = flags.some((f) => f.level === "high");
    const flagStyle: Record<string, string> = {
      high: "text-destructive",
      medium: "text-yellow-500",
      info: "text-muted-foreground",
    };
    return (
      <div className={`rounded-lg border bg-card/40 p-4 space-y-3 ${hasHigh ? "border-destructive/50" : "border-border"}`}>
        <div className="flex items-center gap-3">
          <img src={coverByKey[s.cover_key] ?? coverByKey.album1} alt="" width={48} height={48} className="size-12 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{s.title}</div>
            <div className="text-xs text-muted-foreground truncate">{s.artist} • {s.album} • {s.duration}</div>
          </div>
          {hasHigh && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-destructive/15 text-destructive flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> Copyright
            </span>
          )}
          {s.status !== "pending" && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === "approved" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
              {s.status}
            </span>
          )}
        </div>
        {s.note && <p className="text-xs text-muted-foreground italic">“{s.note}”</p>}
        {url ? <audio controls src={url} className="w-full" /> : <p className="text-xs text-destructive">No audio file.</p>}

        {/* Copyright check */}
        <div className="rounded-md border border-border bg-elevated/40 p-3 space-y-1.5">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Copyright check
          </div>
          <div className="text-xs text-muted-foreground">
            Declared: <span className="text-foreground">{RIGHTS_LABEL[s.rights]}</span> ·{" "}
            Ownership {s.owns_rights
              ? <span className="text-primary font-medium">confirmed</span>
              : <span className="text-destructive font-medium">NOT confirmed</span>}
          </div>
          {flags.length === 0 ? (
            <div className="text-xs text-primary flex items-center gap-1"><Check className="size-3.5" /> No automatic flags.</div>
          ) : (
            <ul className="space-y-1">
              {flags.map((f, i) => (
                <li key={i} className={`text-xs flex items-start gap-1.5 ${flagStyle[f.level]}`}>
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" /> {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        {s.status === "pending" && (
          <div className="flex gap-2">
            <button onClick={() => approve(s)} disabled={busyId === s.id}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
              {busyId === s.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve & publish
            </button>
            <button onClick={() => reject(s)} disabled={busyId === s.id}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold disabled:opacity-60">
              <XCircle className="size-4" /> Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Submissions</h1>
        <p className="text-sm text-muted-foreground">Tracks users submitted for publishing. Approving adds them to the catalog.</p>
      </div>

      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : error ? (
        <p className="text-sm text-destructive">Couldn't load submissions.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Inbox className="size-4" /> Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
            ) : (
              pending.map((s) => <Card key={s.id} s={s} />)
            )}
          </section>

          {reviewed.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-muted-foreground">Reviewed</h2>
              {reviewed.map((s) => <Card key={s.id} s={s} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ── Account section ──────────────────────────────────────── */

function AccountSection() {
  const { user } = useAuth();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.length < 6) return setPwMsg({ ok: false, text: "Password must be at least 6 characters." });
    if (pw !== pw2) return setPwMsg({ ok: false, text: "Passwords don't match." });
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) return setPwMsg({ ok: false, text: error.message });
    setPw(""); setPw2("");
    setPwMsg({ ok: true, text: "Password updated." });
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setEmailMsg({ ok: false, text: "Enter a valid email." });
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email });
    setEmailBusy(false);
    if (error) return setEmailMsg({ ok: false, text: error.message });
    setEmail("");
    setEmailMsg({ ok: true, text: "Check your new inbox to confirm the change." });
  }

  const field = "w-full rounded-md bg-elevated border border-input focus:border-primary px-3 py-2 text-sm outline-none transition";
  const msgClass = (ok: boolean) => `text-sm ${ok ? "text-primary" : "text-destructive"}`;

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold mb-1">Account</h1>
        <p className="text-sm text-muted-foreground">Signed in as <span className="text-foreground font-medium">{user?.email}</span></p>
      </div>

      <form onSubmit={changePassword} className="rounded-lg border border-border bg-card/40 p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="size-4" /> Change password</h2>
        <label className="space-y-1 text-sm block"><span className="font-medium">New password</span>
          <input type="password" autoComplete="new-password" className={field} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </label>
        <label className="space-y-1 text-sm block"><span className="font-medium">Confirm new password</span>
          <input type="password" autoComplete="new-password" className={field} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
        </label>
        {pwMsg && <p className={msgClass(pwMsg.ok)}>{pwMsg.text}</p>}
        <button type="submit" disabled={pwBusy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-60">
          {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Update password
        </button>
      </form>

      <form onSubmit={changeEmail} className="rounded-lg border border-border bg-card/40 p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Mail className="size-4" /> Change email</h2>
        <label className="space-y-1 text-sm block"><span className="font-medium">New email</span>
          <input type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
        </label>
        {emailMsg && <p className={msgClass(emailMsg.ok)}>{emailMsg.text}</p>}
        <button type="submit" disabled={emailBusy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-elevated hover:bg-secondary font-bold disabled:opacity-60">
          {emailBusy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Update email
        </button>
      </form>
    </div>
  );
}
