import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#16a34a",
        "primary-hover": "#15803d",
        "surface-light": "#ffffff",
        "bg-light": "#f9fafb",
        "border-light": "#e5e7eb",
        "text-main": "#111827",
        "text-muted": "#6b7280",
        "accent-red": "#dc2626",
      },
      boxShadow: {
        panel: "0 10px 24px rgba(15,23,42,0.06)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
