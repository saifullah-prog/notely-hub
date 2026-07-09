import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeId = "emerald" | "violet" | "ocean" | "light";

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "emerald", label: "Emerald", swatch: "oklch(0.78 0.19 145)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.66 0.20 293)" },
  { id: "ocean", label: "Ocean", swatch: "oklch(0.74 0.13 235)" },
  { id: "light", label: "Light", swatch: "oklch(0.62 0.17 145)" },
];

const STORAGE_KEY = "rocky-theme";
const DEFAULT_THEME: ThemeId = "emerald";

/**
 * Inline script injected in <head> so the saved theme is applied *before* the
 * page paints — avoids a flash of the default theme on load.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Sync from localStorage on mount (client only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (saved && THEMES.some((t) => t.id === saved)) {
        setThemeState(saved);
        applyTheme(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState(next);
        applyTheme(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a <ThemeProvider>");
  return ctx;
}
