import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Aptos", "Segoe UI Variable Text", "Segoe UI", "sans-serif"],
        heading: ["Bahnschrift", "Aptos Display", "Segoe UI", "sans-serif"]
      },
      colors: {
        surface: "#F8FAFC",
        ink: "#0F172A",
        accent: "#0EA5E9",
        accentDark: "#0369A1",
        success: "#059669",
        danger: "#DC2626"
      },
      boxShadow: {
        card: "0 20px 40px -24px rgba(15, 23, 42, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
