import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Track } from "./songs";

export type RepeatMode = "off" | "all" | "one";

export const trackKey = (t: Track) => `${t.title}__${t.artist}`;

/** Format seconds as m:ss. */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type PlayerContextValue = {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** True when the current track has no playable audio (no file uploaded yet). */
  missingAudio: boolean;
  playTrack: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: (t: Track) => void;
  isLiked: (t: Track) => boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const LIKES_KEY = "rocky-likes";

function randomIndexExcept(length: number, except: number): number {
  if (length <= 1) return 0;
  let i = except;
  while (i === except) i = Math.floor(Math.random() * length);
  return i;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endedRef = useRef<() => void>(() => {});

  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [likes, setLikes] = useState<Record<string, boolean>>({});

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const missingAudio = Boolean(current && !current.audioUrl);

  // Create the audio element once (client only) and wire events.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => endedRef.current();

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

  // Load persisted likes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      if (raw) setLikes(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Keep the audio element's volume/mute in sync.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
    }
  }, [volume, muted]);

  function loadAndPlay(track: Track | undefined) {
    const audio = audioRef.current;
    if (!audio || !track) return;
    setCurrentTime(0);
    setDuration(0);
    if (track.audioUrl) {
      audio.src = track.audioUrl;
      audio.currentTime = 0;
      audio.play().catch(() => setIsPlaying(false));
    } else {
      // No audio uploaded for this track yet.
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
    }
  }

  function goTo(i: number, q: Track[] = queue) {
    setIndex(i);
    loadAndPlay(q[i]);
  }

  // Advance to the next track. `auto` = triggered by a track ending.
  function advance(auto: boolean) {
    if (queue.length === 0) return;
    if (auto && repeat === "one") {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    let i = shuffle ? randomIndexExcept(queue.length, index) : index + 1;
    if (i >= queue.length) {
      if (repeat === "all") i = 0;
      else {
        const audio = audioRef.current;
        if (audio) audio.pause();
        setIsPlaying(false);
        return;
      }
    }
    goTo(i);
  }
  endedRef.current = () => advance(true);

  const value: PlayerContextValue = {
    queue,
    index,
    current,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    missingAudio,
    playTrack: (track, q) => {
      const list = q && q.length ? q : [track];
      const found = list.findIndex((t) => trackKey(t) === trackKey(track));
      const i = found >= 0 ? found : 0;
      setQueue(list);
      goTo(i, list);
    },
    toggle: () => {
      const audio = audioRef.current;
      if (!audio || !current) return;
      if (isPlaying) audio.pause();
      else if (current.audioUrl) audio.play().catch(() => {});
    },
    next: () => advance(false),
    prev: () => {
      const audio = audioRef.current;
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }
      if (queue.length === 0) return;
      let i = index - 1;
      if (i < 0) i = repeat === "all" ? queue.length - 1 : 0;
      goTo(i);
    },
    seek: (time) => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = time;
      setCurrentTime(time);
    },
    setVolume: (v) => {
      setVolumeState(v);
      if (v > 0) setMuted(false);
    },
    toggleMute: () => setMuted((m) => !m),
    toggleShuffle: () => setShuffle((s) => !s),
    cycleRepeat: () =>
      setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    toggleLike: (t) => {
      setLikes((prev) => {
        const next = { ...prev, [trackKey(t)]: !prev[trackKey(t)] };
        try {
          localStorage.setItem(LIKES_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    isLiked: (t) => Boolean(likes[trackKey(t)]),
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a <PlayerProvider>");
  return ctx;
}
