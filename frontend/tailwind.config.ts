import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#3B82F6",
          secondary: "#E7E7E7",
          accent: "#F9C784",
          dark: "#1E3A8A",
        },
        sidebar: {
          DEFAULT: "#E7E7E7",   // 요청하신 밝은 그레이 배경
          hover: "#D1D5DB",
          active: "#3B82F6",    // 요청하신 선택 메뉴 배경 (Vibrant Blue)
          border: "#D1D5DB",
        },
      },
    },
  },
  plugins: [],
};

export default config;
