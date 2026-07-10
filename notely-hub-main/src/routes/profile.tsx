import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Heart, Play, Pause, Loader2, ArrowLeft, LogOut, UserCog, KeyRound, Mail, ListMusic,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useSongs, type Track } from "@/lib/songs";
import { usePlayer, trackKey } from "@/lib/player";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Your Profile — Rocky" }] }),
  component: ProfilePage,
});

type ProfileTab = "favourites" | "account";

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<ProfileTab>("favourites");

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

  const initial = (user.email ?? "R").charAt(0).toUpperCase();
  const tabs: { id: ProfileTab; label: string; icon: typeof Heart }[] = [
    { id: "favourites", label: "Favourites", icon: Heart },
    { id: "account", label: "Account", icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center uppercase">
            {initial}
          </span>
          Your Profile
        </div>
        <div className="flex-1" />
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <ArrowLeft className="size-4" /> <span className="hidden sm:block">App</span>
        </Link>
        <button onClick={() => signOut()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold">
          <LogOut className="size-4" /> <span className="hidden sm:block">Log out</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 max-w-5xl w-full mx-auto">
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
          {tab === "favourites" ? <FavouritesSection /> : <AccountSection />}
        </main>
      </div>
    </div>
  );
}

/* ── Favourites (Liked Songs playlist) ────────────────────── */

function FavouritesSection() {
  const { data: songs = [] } = useSongs();
  const player = usePlayer();

  const favourites = useMemo(
    () => songs.filter((t) => player.isLiked(t)),
    // isLiked reads player.likes; re-run when songs or the like state changes
    [songs, player],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="size-28 rounded-lg bg-gradient-to-br from-primary/70 to-primary/20 grid place-items-center shadow-xl">
          <Heart className="size-12 fill-current text-primary-foreground" />
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase">Playlist</div>
          <h1 className="text-3xl font-bold">Liked Songs</h1>
          <div className="text-sm text-muted-foreground mt-1">{favourites.length} song{favourites.length === 1 ? "" : "s"}</div>
        </div>
        {favourites.length > 0 && (
          <button
            onClick={() => player.playTrack(favourites[0], favourites)}
            className="ml-auto size-14 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition shadow-lg"
            aria-label="Play liked songs"
          >
            <Play className="size-6 fill-current" />
          </button>
        )}
      </div>

      {favourites.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          <ListMusic className="size-8 mx-auto mb-2 opacity-60" />
          You haven't liked any songs yet.
          <br />
          Tap the <Heart className="inline size-3.5" /> on any song to add it here.
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {favourites.map((t, i) => (
            <FavouriteRow key={trackKey(t)} track={t} index={i} queue={favourites} />
          ))}
        </div>
      )}
    </div>
  );
}

function FavouriteRow({ track, index, queue }: { track: Track; index: number; queue: Track[] }) {
  const player = usePlayer();
  const isCurrent = player.current && trackKey(player.current) === trackKey(track);
  const isPlaying = isCurrent && player.isPlaying;

  return (
    <div
      onClick={() => player.playTrack(track, queue)}
      className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition ${isCurrent ? "bg-elevated" : "hover:bg-elevated/50"}`}
    >
      <span className="w-5 text-center text-xs text-muted-foreground">
        {isPlaying ? <Pause className="size-3.5 inline fill-current text-primary" /> : index + 1}
      </span>
      <img src={track.cover} alt="" width={40} height={40} className="size-10 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>{track.title}</div>
        <div className="text-xs text-muted-foreground truncate">{track.artist}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); player.toggleLike(track); }}
        aria-label="Remove from liked"
        className="text-primary"
      >
        <Heart className="size-4 fill-current" />
      </button>
      <span className="text-xs text-muted-foreground w-10 text-right">{track.duration}</span>
    </div>
  );
}

/* ── Account (email + change password) ────────────────────── */

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
