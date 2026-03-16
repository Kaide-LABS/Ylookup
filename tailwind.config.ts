import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        yl: {
          bg: "#0b0f0b",
          card: "#141a14",
          border: "#1f2b1f",
          "border-light": "#2a3a2a",
          accent: "#4ade80",
          "accent-dim": "#22c55e",
          muted: "#9ca3af",
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
