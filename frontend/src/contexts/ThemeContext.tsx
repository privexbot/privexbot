/**
 * Theme Context
 *
 * WHY: Provide dark/light mode support with system preference detection
 * HOW: React Context with localStorage persistence and system theme detection
 *
 * FEATURES:
 * - System theme detection (default)
 * - Light mode
 * - Dark mode
 * - localStorage persistence
 * - Automatic theme class application to document root
 */

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  actualTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [actualTheme, setActualTheme] = useState<"light" | "dark">("dark");

  // Get system theme preference
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  // Get resolved theme (system → light/dark)
  const getResolvedTheme = (theme: Theme): "light" | "dark" => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  };

  // Set theme with localStorage persistence
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    const resolved = getResolvedTheme(newTheme);
    setActualTheme(resolved);
    updateDocumentTheme(resolved);
  };

  // Update document root class
  const updateDocumentTheme = (resolvedTheme: "light" | "dark") => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  };

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const initialTheme = storedTheme || "system";
    const resolved = getResolvedTheme(initialTheme);

    setThemeState(initialTheme);
    setActualTheme(resolved);
    updateDocumentTheme(resolved);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setActualTheme(newTheme);
      updateDocumentTheme(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to use theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
