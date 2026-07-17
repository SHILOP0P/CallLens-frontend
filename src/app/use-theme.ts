import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  AppTheme,
  getSystemTheme,
  readThemePreference,
  THEME_KEY,
  ThemePreference,
  ThemeToggleEvent,
  ViewTransitionDocument
} from "./runtime";

/** Keeps system-theme tracking and the optional circular transition out of the app composition root. */
export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readThemePreference());
  const [systemTheme, setSystemTheme] = useState<AppTheme>(() => getSystemTheme());
  const theme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");

    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function toggleTheme(event: ThemeToggleEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY)
    );
    const root = document.documentElement;
    const transitionDocument = document as ViewTransitionDocument;

    root.style.setProperty("--theme-reveal-x", `${originX}px`);
    root.style.setProperty("--theme-reveal-y", `${originY}px`);
    root.style.setProperty("--theme-reveal-radius", `${radius}px`);

    const applyTheme = () => {
      flushSync(() => {
        setThemePreference((current) => {
          const currentTheme = current === "system" ? systemTheme : current;
          const nextTheme: AppTheme = currentTheme === "dark" ? "light" : "dark";
          localStorage.setItem(THEME_KEY, nextTheme);
          return nextTheme;
        });
      });
    };

    if (!transitionDocument.startViewTransition) {
      applyTheme();
      return;
    }

    root.classList.add("theme-reveal-running");
    const transition = transitionDocument.startViewTransition(applyTheme);
    transition.finished.finally(() => {
      root.classList.remove("theme-reveal-running");
      root.style.removeProperty("--theme-reveal-x");
      root.style.removeProperty("--theme-reveal-y");
      root.style.removeProperty("--theme-reveal-radius");
    });
  }

  return { theme, toggleTheme };
}
