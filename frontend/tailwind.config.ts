import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: "#0f172a",
          hover: "#1e293b",
          active: "#1d4ed8",
          border: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
