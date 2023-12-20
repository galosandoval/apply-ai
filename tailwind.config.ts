import { type Config } from "tailwindcss"

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {}
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        mytheme: {
          primary: "#efab9e",
          secondary: "#6bbace",
          accent: "#ed9582",
          neutral: "#27333f",
          "base-100": "#283e53",
          info: "#96bee4",
          success: "#106054",
          warning: "#f6bc0e",
          error: "#e96f6d"
        }
      }
    ]
  }
} satisfies Config
