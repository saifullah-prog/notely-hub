import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Home, Search, Library, Plus, Heart, ArrowRight, Bell, X,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, Mic2, ListMusic, Laptop2, Maximize2, ChevronLeft, ChevronRight,
  LogOut,
} from "lucide-react";

import album1 from "@/assets/album1.jpg";
import album2 from "@/assets/album2.jpg";
import album3 from "@/assets/album3.jpg";
import album4 from "@/assets/album4.jpg";
import album5 from "@/assets/album5.jpg";
import album6 from "@/assets/album6.jpg";

import { useAuth } from "@/lib/auth";
import { useSongs, fallbackTracks, type Track } from "@/lib/songs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rocky — Music for everyone" },
      { name: "description", content: "Rocky is a music streaming experience. Millions of songs. No credit card needed." },
      { property: "og:title", content: "Rocky — Music for everyone" },
      { property: "og:description", content: "Rocky is a music streaming experience. Millions of songs. No credit card needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RockyHome,
});

const albums = [
  { title: "Neon Peaks", artist: "Aurora Wave", cover: album1, tint: "from-purple-900" },
  { title: "Sunset Drive", artist: "Palm Coast", cover: album2, tint: "from-pink-900" },
  { title: "Quiet Hours", artist: "Vera Lune", cover: album3, tint: "from-slate-800" },
  { title: "Cosmic Drift", artist: "Nebula 9", cover: album4, tint: "from-indigo-900" },
  { title: "Concrete Kings", artist: "Block Party", cover: album5, tint: "from-red-900" },
  { title: "Cotton Sky", artist: "June Bloom", cover: album6, tint: "from-sky-800" },
];

const playlists = [
  { name: "Liked Songs", sub: "Playlist • 247 songs", cover: album3 },
  { name: "Daily Mix 1", sub: "Aurora Wave, Nebula 9 and more", cover: album1 },
  { name: "Discover Weekly", sub: "Your weekly mixtape", cover: album4 },
  { name: "Chill Vibes", sub: "Made for you", cover: album6 },
  { name: "Late Night Drive", sub: "Palm Coast, Block Party", cover: album2 },
  { name: "Underground Hip Hop", sub: "Fresh cuts weekly", cover: album5 },
  { name: "Focus Flow", sub: "Deep concentration", cover: album3 },
];

type Artist = { name: string; cover: string };

function RockyHome() {
  const [playing, setPlaying] = useState(false);
  const [current] = useState(albums[0]);
  const [progress, setProgress] = useState(38);
  const [query, setQuery] = useState("");

  // Song catalog comes from Supabase, with the bundled list as fallback.
  const { data: tracks = fallbackTracks } = useSongs();
  const { user, signOut } = useAuth();

  const artists = useMemo<Artist[]>(
    () =>
      Array.from(new Set(tracks.map((t) => t.artist))).map((name) => {
        const t = tracks.find((x) => x.artist === name)!;
        return { name, cover: t.cover };
      }),
    [tracks],
  );

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return {
      tracks: tracks.filter((t) =>
        [t.title, t.artist, t.album].some((v) => v.toLowerCase().includes(q))
      ),
      artists: artists.filter((a) => a.name.toLowerCase().includes(q)),
      albums: albums.filter((a) =>
        [a.title, a.artist].some((v) => v.toLowerCase().includes(q))
      ),
    };
  }, [q, tracks, artists]);
  const totalResults = results
    ? results.tracks.length + results.artists.length + results.albums.length
    : 0;


  return (
    <div className="h-screen w-screen bg-black text-foreground flex flex-col overflow-hidden">
      {/* Top area: sidebar + main */}
      <div className="flex flex-1 gap-2 p-2 min-h-0">
        {/* Sidebar */}
        <aside className="w-[340px] shrink-0 flex flex-col gap-2">
          {/* Nav */}
          <div className="bg-sidebar rounded-lg p-2">
            <button className="flex items-center gap-4 w-full px-4 py-3 rounded-md text-sidebar-foreground hover:text-foreground font-semibold transition">
              <Home className="size-6" /> Home
            </button>
            <button className="flex items-center gap-4 w-full px-4 py-3 rounded-md text-sidebar-foreground hover:text-foreground font-semibold transition">
              <Search className="size-6" /> Search
            </button>
          </div>

          {/* Library */}
          <div className="bg-sidebar rounded-lg flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <button className="flex items-center gap-3 text-sidebar-foreground hover:text-foreground font-semibold">
                <Library className="size-6" /> Your Library
              </button>
              <div className="flex gap-1">
                <button className="size-8 rounded-full grid place-items-center hover:bg-elevated text-sidebar-foreground hover:text-foreground">
                  <Plus className="size-4" />
                </button>
                <button className="size-8 rounded-full grid place-items-center hover:bg-elevated text-sidebar-foreground hover:text-foreground">
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-hidden">
              {["Playlists", "Artists", "Albums", "Podcasts"].map((t) => (
                <button key={t} className="px-3 py-1.5 text-sm rounded-full bg-elevated hover:bg-neutral-700 whitespace-nowrap">
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hidden px-2 pb-3 space-y-1">
              {playlists.map((p) => (
                <button key={p.name} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-elevated transition text-left">
                  <img src={p.cover} alt={p.name} width={48} height={48} loading="lazy" className="size-12 rounded object-cover" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 bg-gradient-to-b from-neutral-800 to-background rounded-lg overflow-y-auto scrollbar-hidden">
          {/* Top bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-md">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button className="size-8 rounded-full bg-black/60 grid place-items-center hover:bg-black/80 shrink-0">
                <ChevronLeft className="size-5" />
              </button>
              <button className="size-8 rounded-full bg-black/60 grid place-items-center hover:bg-black/80 shrink-0">
                <ChevronRight className="size-5" />
              </button>
              <div className="relative ml-2 w-full max-w-md">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you want to play?"
                  aria-label="Search tracks, artists, albums"
                  className="w-full bg-elevated/80 hover:bg-elevated focus:bg-elevated border border-transparent focus:border-white/40 rounded-full pl-10 pr-10 py-2.5 text-sm outline-none transition"
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
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button className="px-4 py-2 rounded-full bg-white text-black text-sm font-bold hover:scale-105 transition">
                Explore Premium
              </button>
              <button className="size-8 rounded-full bg-black/60 grid place-items-center hover:bg-black/80">
                <Bell className="size-4" />
              </button>
              {user ? (
                <>
                  <span
                    title={user.email ?? "Account"}
                    className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-sm uppercase"
                  >
                    {(user.email ?? "R").charAt(0)}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 hover:bg-black/80 text-sm font-semibold"
                  >
                    <LogOut className="size-4" /> Log out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full bg-black/60 hover:bg-black/80 text-sm font-bold"
                >
                  Log in
                </Link>
              )}
            </div>
          </div>

          <div className="px-6 pb-8">
            {results ? (
              <SearchResults query={query} results={results} total={totalResults} />
            ) : (
              <>
                {/* Chips */}
                <div className="flex gap-2 mb-6">
                  {["All", "Music", "Podcasts"].map((c, i) => (
                    <button key={c} className={`px-4 py-1.5 rounded-full text-sm font-medium ${i === 0 ? "bg-white text-black" : "bg-elevated hover:bg-neutral-700"}`}>
                      {c}
                    </button>
                  ))}
                </div>

                {/* Quick tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  {playlists.slice(0, 6).map((p) => (
                    <div key={p.name} className="group flex items-center gap-3 bg-elevated/60 hover:bg-elevated rounded-md overflow-hidden cursor-pointer transition">
                      <img src={p.cover} alt={p.name} width={80} height={80} loading="lazy" className="size-20 object-cover" />
                      <span className="font-semibold truncate flex-1">{p.name}</span>
                      <button className="mr-4 size-12 rounded-full bg-primary text-primary-foreground grid place-items-center opacity-0 group-hover:opacity-100 shadow-lg translate-y-2 group-hover:translate-y-0 transition">
                        <Play className="size-5 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>

                <Row title="Made For Rocky" items={albums} />
                <Row title="Trending now" items={[...albums].reverse()} />
                <Row title="New releases" items={albums.slice(1).concat(albums[0])} />
              </>
            )}
          </div>

        </main>
      </div>

      {/* Player */}
      <footer className="h-20 shrink-0 grid grid-cols-3 items-center px-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={current.cover} alt={current.title} width={56} height={56} loading="lazy" className="size-14 rounded object-cover" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{current.title}</div>
            <div className="text-xs text-muted-foreground truncate">{current.artist}</div>
          </div>
          <button className="ml-3 text-muted-foreground hover:text-primary">
            <Heart className="size-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-5">
            <button className="text-muted-foreground hover:text-foreground"><Shuffle className="size-4" /></button>
            <button className="text-muted-foreground hover:text-foreground"><SkipBack className="size-5" /></button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="size-8 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition"
            >
              {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
            </button>
            <button className="text-muted-foreground hover:text-foreground"><SkipForward className="size-5" /></button>
            <button className="text-muted-foreground hover:text-foreground"><Repeat className="size-4" /></button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-md text-xs text-muted-foreground">
            <span>1:24</span>
            <input
              type="range" min={0} max={100} value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="flex-1 accent-primary h-1"
            />
            <span>3:42</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 text-muted-foreground">
          <button className="hover:text-foreground"><Mic2 className="size-4" /></button>
          <button className="hover:text-foreground"><ListMusic className="size-4" /></button>
          <button className="hover:text-foreground"><Laptop2 className="size-4" /></button>
          <Volume2 className="size-4" />
          <input type="range" min={0} max={100} defaultValue={70} className="w-24 accent-primary h-1" />
          <button className="hover:text-foreground"><Maximize2 className="size-4" /></button>
        </div>
      </footer>
    </div>
  );
}

function Row({ title, items }: { title: string; items: typeof albums }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold hover:underline cursor-pointer">{title}</h2>
        <button className="text-xs font-bold text-muted-foreground hover:underline">Show all</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((a) => (
          <div key={a.title + title} className="group p-4 rounded-lg bg-elevated/40 hover:bg-elevated transition cursor-pointer relative">
            <div className="relative mb-4">
              <img src={a.cover} alt={a.title} width={240} height={240} loading="lazy" className="w-full aspect-square object-cover rounded-md shadow-xl" />
              <button className="absolute bottom-2 right-2 size-12 rounded-full bg-primary text-primary-foreground grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 shadow-2xl transition">
                <Play className="size-5 fill-current" />
              </button>
            </div>
            <div className="text-sm font-semibold truncate">{a.title}</div>
            <div className="text-xs text-muted-foreground truncate mt-1">{a.artist}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

type Results = {
  tracks: Track[];
  artists: Artist[];
  albums: typeof albums;
};

function SearchResults({ query, results, total }: { query: string; results: Results; total: number }) {
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

  const top = results.tracks[0] ?? null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {top && (
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4">Top result</h2>
            <div className="group bg-elevated/60 hover:bg-elevated rounded-lg p-5 transition cursor-pointer relative">
              <img src={top.cover} alt={top.title} width={92} height={92} loading="lazy" className="size-24 rounded-md object-cover shadow-lg mb-4" />
              <div className="text-2xl font-bold truncate">{top.title}</div>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="mr-2">Song</span>·<span className="mx-2">{top.artist}</span>
              </div>
              <button className="absolute bottom-5 right-5 size-12 rounded-full bg-primary text-primary-foreground grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 shadow-2xl transition">
                <Play className="size-5 fill-current" />
              </button>
            </div>
          </div>
        )}

        {results.tracks.length > 0 && (
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-bold mb-4">Songs</h2>
            <div className="space-y-1">
              {results.tracks.slice(0, 4).map((t) => (
                <div key={t.title + t.artist} className="group flex items-center gap-3 p-2 rounded-md hover:bg-elevated transition cursor-pointer">
                  <img src={t.cover} alt={t.title} width={40} height={40} loading="lazy" className="size-10 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.artist}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{t.duration}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {results.artists.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Artists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.artists.map((a) => (
              <div key={a.name} className="group p-4 rounded-lg bg-elevated/40 hover:bg-elevated transition cursor-pointer">
                <img src={a.cover} alt={a.name} width={200} height={200} loading="lazy" className="w-full aspect-square object-cover rounded-full shadow-xl mb-4" />
                <div className="text-sm font-semibold truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground mt-1">Artist</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.albums.length > 0 && (
        <Row title="Albums" items={results.albums} />
      )}
    </div>
  );
}
