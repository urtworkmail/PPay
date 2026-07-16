import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(undefined);
const STORAGE_KEY = "ppay_theme";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || "system");
  const [resolved, setResolved] = useState(() => (mode === "system" ? getSystemTheme() : mode));

  useEffect(() => {
    const effective = mode === "system" ? getSystemTheme() : mode;
    setResolved(effective);
    document.documentElement.setAttribute("data-theme", effective);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const effective = getSystemTheme();
      setResolved(effective);
      document.documentElement.setAttribute("data-theme", effective);
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [mode]);

  function cycleTheme() {
    setMode((current) => (current === "light" ? "dark" : current === "dark" ? "system" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, cycleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
