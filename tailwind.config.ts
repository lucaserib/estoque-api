import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{html,js,tsx,ts}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
