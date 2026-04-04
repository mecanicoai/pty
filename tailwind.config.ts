import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          app: "#efeae2",
          panel: "#f0f2f5",
          out: "#d9fdd3",
          in: "#ffffff",
          text: "#111b21",
          meta: "#8696a0",
          accent: "#00a884",
          accentDark: "#008069"
        }
      },
      boxShadow: {
        app: "0 14px 36px rgba(17, 27, 33, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
