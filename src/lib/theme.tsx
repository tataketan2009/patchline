import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "patchline-theme";

/** Storage can throw when blocked (private browsing, restricted webviews). */
function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "dark";
  } catch {
    return "dark";
  }
}

function persist(t: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* non-fatal: theme just won't survive a reload */
  }
}

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    persist(theme);
  }, [theme]);

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggle: () => setThemeState(theme === "dark" ? "light" : "dark"),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

/** DEMO badge text so reviewers know the dataset is synthetic. */
export const DEMO_LABEL = "Demo data";
