import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Search, Library, Heart, X, Music2,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, Volume1, VolumeX, ListMusic, Maximize2,
  LogOut, Palette, Check, PanelRightClose, PanelRightOpen,
} from "lucide-react";

import album1 from "@/assets/album1.jpg";
import album2 from "@/assets/album2.jpg";
import album3 from "@/assets/album3.jpg";
import album4 from "@/assets/album4.jpg";
import album5 from "@/assets/album5.jpg";
import album6 from "@/assets/album6.jpg";

import { useAuth } from "@/lib/auth";
import { useSongs, fallbackTracks, type Track } from "@/lib/songs";
import { usePlaylists, fallbackPlaylists, type Playlist } from "@/lib/playlists";
import { useTheme, THEMES, type ThemeId } from "@/lib/theme";
import { usePlayer, trackKey, formatTime } from "@/lib/player";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rocky — Music for everyone" },
      { name: "description", content: "Rocky is a music streaming experience. Millions of songs. No credit card needed." },
      { property: "og:title", content: "Rocky — Music for everyone" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RockyHome,
});

const albums = [
  { title: "Neon Peaks", artist: "Aurora Wave", cover: album1 },
  { title: "Sunset Drive", artist: "Palm Coast", cover: album2 },
  { title: "Quiet Hours", artist: "Vera Lune", cover: album3 },
  { title: "Cosmic Drift", artist: "Nebula 9", cover: album4 },
  { title: "Concrete Kings", artist: "Block Party", cover: album5 },
  { title: "Cotton Sky", artist: "June Bloom", cover: album6 },
];
type Album = (typeof albums)[number];

type Artist = { name: string; cover: string };

const CATEGORIES = ["all", "songs", "artists", "albums", "playlists"] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_LABEL: Record<Category, string> = {
  all: "All", songs: "Songs", artists: "Artists", albums: "Albums", playlists: "Playlists",
};

type View = "home" | "library";

function RockyHome() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("home");
  const [category, setCategory] = useState<Category>("all");
  const [panelOpen, setPanelOpen] = useState(true);

  const { data: tracks = fallbackTracks } = useSongs();
  const { data: playlists = fallbackPlaylists } = usePlaylists();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const artists = useMemo<Artist[]>(
    () =>
      Array.from(new Set(tracks.map((t) => t.artist))).map((name) => {
        const t = tracks.find((x) => x.artist === name)!;
        return { name, cover: t.cover };
      }),
    [tracks],
  );

  // Queue builders for "play this context".
  const songsForAlbum = (title: string) => tracks.filter((t) => t.album === title);
  const songsForArtist = (name: string) => tracks.filter((t) => t.artist === name);
  const songsForPlaylist = (p: Playlist) => (p.artist ? songsForArtist(p.artist) : tracks);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return {
      tracks: tracks.filter((t) => [t.title, t.artist, t.album].some((v) => v.toLowerCase().includes(q))),
      artists: artists.filter((a) => a.name.toLowerCase().includes(q)),
      albums: albums.filter((a) => [a.title, a.artist].some((v) => v.toLowerCase().includes(q))),
      playlists: playlists.filter((p) => [p.name, p.sub, p.artist ?? ""].some((v) => v.toLowerCase().includes(q))),
    };
  }, [q, tracks, artists, playlists]);
  const totalResults = results
    ? results.tracks.length + results.artists.length + results.albums.length + results.playlists.length
    : 0;

  function onQueryChange(value: string) {
    setQuery(value);
    setCategory("all");
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* ── Top navigation ─────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border bg-sidebar">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0 mr-2">
          <span className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Music2 className="size-5" />
          </span>
          <span className="hidden sm:block">Rocky</span>
        </Link>

        <nav className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setView("home"); setQuery(""); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition ${
              view === "home" && !q ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="size-4" /> <span className="hidden md:block">Home</span>
          </button>
          <button
            onClick={() => { setView("library"); setQuery(""); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition ${
              view === "library" && !q ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Library className="size-4" /> <span className="hidden md:block">Library</span>
          </button>
        </nav>

        <div className="relative flex-1 max-w-md mx-auto">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search songs, artists, albums, playlists"
            aria-label="Search songs, artists, albums and playlists"
            className="w-full bg-elevated/80 hover:bg-elevated focus:bg-elevated border border-transparent focus:border-ring/60 rounded-full pl-10 pr-9 py-2.5 text-sm outline-none transition"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={panelOpen ? "Hide now playing" : "Show now playing"}
            className="size-9 rounded-full bg-elevated grid place-items-center hover:bg-secondary text-foreground"
          >
            {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
          {user ? (
            <>
              <span
                title={user.email ?? "Account"}
                className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-sm uppercase"
              >
                {(user.email ?? "R").charAt(0)}
              </span>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-elevated hover:bg-secondary text-sm font-semibold"
              >
                <LogOut className="size-4" /> <span className="hidden lg:block">Log out</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:scale-105 transition">
              Log in
            </Link>
          )}
        </div>
      </header>

      {/* ── Content + right panel ──────────────────────── */}
      <div className="flex-1 flex gap-2 p-2 min-h-0">
        <main className="flex-1 bg-gradient-to-b from-elevated to-background rounded-lg overflow-y-auto scrollbar-hidden px-6 py-6">
          {results ? (
            <SearchResults
              query={query}
              results={results}
              total={totalResults}
              category={category}
              setCategory={setCategory}
              songsForAlbum={songsForAlbum}
              songsForPlaylist={songsForPlaylist}
              songsForArtist={songsForArtist}
            />
          ) : view === "home" ? (
            <HomeView
              tracks={tracks}
              playlists={playlists}
              songsForAlbum={songsForAlbum}
              songsForPlaylist={songsForPlaylist}
            />
          ) : (
            <LibraryView
              playlists={playlists}
              artists={artists}
              songsForPlaylist={songsForPlaylist}
              songsForArtist={songsForArtist}
              songsForAlbum={songsForAlbum}
            />
          )}
        </main>

        {panelOpen && <NowPlayingPanel />}
      </div>

      {/* ── Player bar ─────────────────────────────────── */}
      <PlayerBar />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Content views
 * ───────────────────────────────────────────────────────── */

function HomeView({
  tracks,
  playlists,
  songsForAlbum,
  songsForPlaylist,
}: {
  tracks: Track[];
  playlists: Playlist[];
  songsForAlbum: (t: string) => Track[];
  songsForPlaylist: (p: Playlist) => Track[];
}) {
  const player = usePlayer();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Good vibes</h1>
        <p className="text-sm text-muted-foreground">Pick a track and press play.</p>
      </div>

      {/* Quick playlist tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {playlists.slice(0, 6).map((p) => (
          <button
            key={p.name}
            onClick={() => {
              const list = songsForPlaylist(p);
              if (list.length) player.playTrack(list[0], list);
            }}
            className="group flex items-center gap-3 bg-elevated/60 hover:bg-elevated rounded-md overflow-hidden cursor-pointer transition text-left"
          >
            <img src={p.cover} alt={p.name} width={64} height={64} loading="lazy" className="size-16 object-cover" />
            <span className="font-semibold truncate flex-1">{p.name}</span>
            <span className="mr-4 size-11 rounded-full bg-primary text-primary-foreground grid place-items-center opacity-0 group-hover:opacity-100 shadow-lg translate-y-1 group-hover:translate-y-0 transition">
              <Play className="size-5 fill-current" />
            </span>
          </button>
        ))}
      </div>

      <CardRow title="Made For Rocky" albums={albums} songsForAlbum={songsForAlbum} />
      <CardRow title="Trending now" albums={[...albums].reverse()} songsForAlbum={songsForAlbum} />

      <section>
        <h2 className="text-2xl font-bold mb-4">Popular songs</h2>
        <div className="space-y-1">
          {tracks.slice(0, 8).map((t) => (
            <SongRow key={trackKey(t)} track={t} queue={tracks} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LibraryView({
  playlists,
  artists,
  songsForPlaylist,
  songsForArtist,
  songsForAlbum,
}: {
  playlists: Playlist[];
  artists: Artist[];
  songsForPlaylist: (p: Playlist) => Track[];
  songsForArtist: (n: string) => Track[];
  songsForAlbum: (t: string) => Track[];
}) {
  const player = usePlayer();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Your Library</h1>

      <section>
        <h2 className="text-2xl font-bold mb-4">Playlists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {playlists.map((p) => (
            <MediaCard
              key={p.name}
              cover={p.cover}
              title={p.name}
              subtitle={p.sub || "Playlist"}
              onPlay={() => {
                const list = songsForPlaylist(p);
                if (list.length) player.playTrack(list[0], list);
              }}
            />
          ))}
        </div>
      </section>

      <ArtistsGrid items={artists} onPlayArtist={(name) => {
        const list = songsForArtist(name);
        if (list.length) player.playTrack(list[0], list);
      }} />

      <CardRow title="Albums" albums={albums} songsForAlbum={songsForAlbum} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Reusable pieces
 * ───────────────────────────────────────────────────────── */

function CardRow({
  title,
  albums: items,
  songsForAlbum,
}: {
  title: string;
  albums: Album[];
  songsForAlbum: (t: string) => Track[];
}) {
  const player = usePlayer();
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((a) => (
          <MediaCard
            key={a.title + title}
            cover={a.cover}
            title={a.title}
            subtitle={a.artist}
            onPlay={() => {
              const list = songsForAlbum(a.title);
              if (list.length) player.playTrack(list[0], list);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function MediaCard({
  cover,
  title,
  subtitle,
  rounded,
  onPlay,
}: {
  cover: string;
  title: string;
  subtitle: string;
  rounded?: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="group p-4 rounded-lg bg-elevated/40 hover:bg-elevated transition cursor-pointer relative" onClick={onPlay}>
      <div className="relative mb-4">
        <img
          src={cover}
          alt={title}
          width={200}
          height={200}
          loading="lazy"
          className={`w-full aspect-square object-cover shadow-xl ${rounded ? "rounded-full" : "rounded-md"}`}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          aria-label={`Play ${title}`}
          className="absolute bottom-2 right-2 size-12 rounded-full bg-primary text-primary-foreground grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 shadow-2xl transition"
        >
          <Play className="size-5 fill-current" />
        </button>
      </div>
      <div className="text-sm font-semibold truncate">{title}</div>
      <div className="text-xs text-muted-foreground truncate mt-1">{subtitle}</div>
    </div>
  );
}

function SongRow({ track, queue }: { track: Track; queue: Track[] }) {
  const player = usePlayer();
  const isCurrent = player.current && trackKey(player.current) === trackKey(track);
  const isPlaying = isCurrent && player.isPlaying;
  const liked = player.isLiked(track);

  return (
    <div
      onClick={() => player.playTrack(track, queue)}
      className={`group flex items-center gap-3 p-2 rounded-md transition cursor-pointer ${
        isCurrent ? "bg-elevated" : "hover:bg-elevated"
      }`}
    >
      <div className="relative size-10 shrink-0">
        <img src={track.cover} alt={track.title} width={40} height={40} loading="lazy" className="size-10 rounded object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/40 rounded opacity-0 group-hover:opacity-100 transition">
          {isPlaying ? <Pause className="size-4 fill-current text-white" /> : <Play className="size-4 fill-current text-white" />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>{track.title}</div>
        <div className="text-xs text-muted-foreground truncate">{track.artist}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); player.toggleLike(track); }}
        aria-label={liked ? "Remove from liked" : "Add to liked"}
        className={`opacity-0 group-hover:opacity-100 transition ${liked ? "opacity-100 text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
      </button>
      <span className="text-xs text-muted-foreground w-10 text-right">{track.duration}</span>
    </div>
  );
}

function ArtistsGrid({ items, onPlayArtist }: { items: Artist[]; onPlayArtist: (name: string) => void }) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Artists</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((a) => (
          <MediaCard key={a.name} cover={a.cover} title={a.name} subtitle="Artist" rounded onPlay={() => onPlayArtist(a.name)} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
 * Search
 * ───────────────────────────────────────────────────────── */

type Results = {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
};

function SearchResults({
  query,
  results,
  total,
  category,
  setCategory,
  songsForAlbum,
  songsForPlaylist,
  songsForArtist,
}: {
  query: string;
  results: Results;
  total: number;
  category: Category;
  setCategory: (c: Category) => void;
  songsForAlbum: (t: string) => Track[];
  songsForPlaylist: (p: Playlist) => Track[];
  songsForArtist: (n: string) => Track[];
}) {
  const player = usePlayer();

  if (total === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-2xl font-bold mb-2">No results found for "{query}"</h2>
        <p className="text-muted-foreground text-sm">
          Please make sure your words are spelled correctly, or use fewer or different keywords.
        </p>
      </div>
    );
  }

  const counts: Record<Category, number> = {
    all: total,
    songs: results.tracks.length,
    artists: results.artists.length,
    albums: results.albums.length,
    playlists: results.playlists.length,
  };
  const tabs = CATEGORIES.filter((c) => c === "all" || counts[c] > 0);
  const show = (c: Category) => category === "all" || category === c;
  const top = results.tracks[0] ?? null;

  return (
    <div className="space-y-8">
      <div className="flex gap-2 flex-wrap">
        {tabs.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              category === c ? "bg-foreground text-background" : "bg-elevated hover:bg-secondary"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {category === "all" && results.tracks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {top && (
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4">Top result</h2>
              <div
                onClick={() => player.playTrack(top, results.tracks)}
                className="group bg-elevated/60 hover:bg-elevated rounded-lg p-5 transition cursor-pointer relative"
              >
                <img src={top.cover} alt={top.title} width={92} height={92} loading="lazy" className="size-24 rounded-md object-cover shadow-lg mb-4" />
                <div className="text-2xl font-bold truncate">{top.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  <span className="mr-2">Song</span>·<span className="mx-2">{top.artist}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); player.playTrack(top, results.tracks); }}
                  aria-label={`Play ${top.title}`}
                  className="absolute bottom-5 right-5 size-12 rounded-full bg-primary text-primary-foreground grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 shadow-2xl transition"
                >
                  <Play className="size-5 fill-current" />
                </button>
              </div>
            </div>
          )}
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-bold mb-4">Songs</h2>
            <div className="space-y-1">
              {results.tracks.slice(0, 4).map((t) => (
                <SongRow key={trackKey(t)} track={t} queue={results.tracks} />
              ))}
            </div>
          </div>
        </div>
      )}

      {category === "songs" && results.tracks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Songs</h2>
          <div className="space-y-1">
            {results.tracks.map((t) => (
              <SongRow key={trackKey(t)} track={t} queue={results.tracks} />
            ))}
          </div>
        </section>
      )}

      {show("artists") && results.artists.length > 0 && (
        <ArtistsGrid items={results.artists} onPlayArtist={(name) => {
          const list = songsForArtist(name);
          if (list.length) player.playTrack(list[0], list);
        }} />
      )}
      {show("albums") && results.albums.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Albums</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.albums.map((a) => (
              <MediaCard key={a.title} cover={a.cover} title={a.title} subtitle={a.artist} onPlay={() => {
                const list = songsForAlbum(a.title);
                if (list.length) player.playTrack(list[0], list);
              }} />
            ))}
          </div>
        </section>
      )}
      {show("playlists") && results.playlists.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Playlists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.playlists.map((p) => (
              <MediaCard key={p.name} cover={p.cover} title={p.name} subtitle={p.sub || "Playlist"} onPlay={() => {
                const list = songsForPlaylist(p);
                if (list.length) player.playTrack(list[0], list);
              }} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Now-playing panel + queue
 * ───────────────────────────────────────────────────────── */

function NowPlayingPanel() {
  const player = usePlayer();
  const { current, queue, index } = player;
  const upcoming = index >= 0 ? queue.slice(index + 1) : [];

  return (
    <aside className="w-[320px] shrink-0 hidden lg:flex flex-col gap-2 bg-sidebar rounded-lg p-4 overflow-y-auto scrollbar-hidden">
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Now playing</h2>
      {current ? (
        <>
          <img src={current.cover} alt={current.title} className="w-full aspect-square object-cover rounded-lg shadow-xl mt-1" />
          <div className="mt-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-lg font-bold truncate">{current.title}</div>
              <div className="text-sm text-muted-foreground truncate">{current.artist}</div>
            </div>
            <button
              onClick={() => player.toggleLike(current)}
              aria-label="Like"
              className={player.isLiked(current) ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            >
              <Heart className={`size-5 ${player.isLiked(current) ? "fill-current" : ""}`} />
            </button>
          </div>
          {player.missingAudio && (
            <p className="text-xs text-yellow-500/90 mt-1">
              No audio uploaded for this track yet — upload it to the <code>audio</code> bucket to hear it.
            </p>
          )}
        </>
      ) : (
        <div className="flex-1 grid place-items-center text-center text-sm text-muted-foreground py-10">
          <div>
            <ListMusic className="size-8 mx-auto mb-2 opacity-60" />
            Nothing playing yet.
            <br />Pick a song to start.
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
            <ListMusic className="size-4" /> Next in queue
          </h3>
          <div className="space-y-1">
            {upcoming.slice(0, 20).map((t, i) => (
              <button
                key={trackKey(t) + i}
                onClick={() => player.playTrack(t, queue)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-elevated transition text-left"
              >
                <img src={t.cover} alt={t.title} width={40} height={40} className="size-10 rounded object-cover" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.artist}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────
 * Player bar
 * ───────────────────────────────────────────────────────── */

function PlayerBar() {
  const player = usePlayer();
  const {
    current, isPlaying, currentTime, duration, volume, muted,
    shuffle, repeat, toggle, next, prev, seek, setVolume, toggleMute,
    toggleShuffle, cycleRepeat,
  } = player;

  const total = duration > 0 ? duration : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <footer className="h-20 shrink-0 grid grid-cols-[1fr_auto_1fr] items-center px-4 gap-4 border-t border-border">
      {/* Track info */}
      <div className="flex items-center gap-3 min-w-0">
        {current ? (
          <>
            <img src={current.cover} alt={current.title} width={56} height={56} className="size-14 rounded object-cover" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{current.title}</div>
              <div className="text-xs text-muted-foreground truncate">{current.artist}</div>
            </div>
            <button
              onClick={() => player.toggleLike(current)}
              aria-label="Like"
              className={`ml-3 ${player.isLiked(current) ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <Heart className={`size-4 ${player.isLiked(current) ? "fill-current" : ""}`} />
            </button>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Select a song to play</div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-2 w-full max-w-[520px]">
        <div className="flex items-center gap-5">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}
          >
            <Shuffle className="size-4" />
          </button>
          <button onClick={prev} aria-label="Previous" className="text-muted-foreground hover:text-foreground">
            <SkipBack className="size-5" />
          </button>
          <button
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            disabled={!current}
            className="size-9 rounded-full bg-foreground text-background grid place-items-center hover:scale-105 transition disabled:opacity-40 disabled:hover:scale-100"
          >
            {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
          <button onClick={next} aria-label="Next" className="text-muted-foreground hover:text-foreground">
            <SkipForward className="size-5" />
          </button>
          <button
            onClick={cycleRepeat}
            aria-label={`Repeat: ${repeat}`}
            className={repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}
          >
            {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2 w-full text-xs text-muted-foreground">
          <span className="w-9 text-right tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={Math.min(currentTime, total || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!current || total === 0}
            aria-label="Seek"
            className="flex-1 accent-primary h-1 disabled:opacity-50"
          />
          <span className="w-9 tabular-nums">{total > 0 ? formatTime(total) : current?.duration ?? "0:00"}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-end gap-2 text-muted-foreground">
        <button className="hover:text-foreground" aria-label="Queue"><ListMusic className="size-4" /></button>
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="hover:text-foreground">
          <VolIcon className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="w-24 accent-primary h-1"
        />
        <button className="hover:text-foreground" aria-label="Fullscreen"><Maximize2 className="size-4" /></button>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────
 * Theme switcher
 * ───────────────────────────────────────────────────────── */

function ThemeSwitcher({ theme, setTheme }: { theme: ThemeId; setTheme: (t: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
        className="size-9 rounded-full bg-elevated grid place-items-center hover:bg-secondary text-foreground"
      >
        <Palette className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-44 rounded-lg bg-popover border border-border shadow-2xl p-1 z-30">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-elevated transition text-left"
            >
              <span className="size-4 rounded-full border border-border" style={{ backgroundColor: t.swatch }} />
              <span className="flex-1">{t.label}</span>
              {theme === t.id && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
