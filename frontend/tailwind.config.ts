import type { Config } from "tailwindcss";

/**
 * Design tokens — see /DESIGN.md for the full rationale.
 *
 * Palette is grounded in the subject: official travel documents, ledgers,
 * seals. "ink" (deep navy) does the work near-black usually does here but
 * reads as document-cover navy rather than a generic dark UI. "brass" is
 * a single, restrained accent reserved for the stamp/status signature
 * element and key actions — it is not sprinkled everywhere.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14203D",
          light: "#233457",
          muted: "#57607A",
        },
        paper: "#F5F7F9",
        surface: "#FFFFFF",
        brass: {
          DEFAULT: "#A87C2A",
          light: "#C79B4A",
          dark: "#8A6420",
        },
        line: "#E1E4EA",
        signal: {
          approved: "#1E7F55",
          pending: "#B07A1E",
          rejected: "#B23B32",
          info: "#2A5FA5",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(20, 32, 61, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
