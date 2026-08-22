import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      /*
        The resume type scale, as tokens rather than literals.

        Every value indirects through a CSS variable declared in `global.css`,
        so a second resume style is a variable change and reflow mode can widen
        the body text without a component knowing it happened. No resume
        component names a size, a spacing step or a rule weight directly.
      */
      fontSize: {
        "resume-name": ["var(--resume-text-name)", "var(--resume-leading-name)"],
        "resume-title": [
          "var(--resume-text-title)",
          "var(--resume-leading-title)"
        ],
        "resume-heading": [
          "var(--resume-text-heading)",
          "var(--resume-leading-heading)"
        ],
        "resume-body": ["var(--resume-text-body)", "var(--resume-leading-body)"]
      },
      spacing: {
        "resume-page-x": "var(--resume-space-page-x)",
        "resume-page-y": "var(--resume-space-page-y)",
        "resume-section": "var(--resume-space-section)",
        "resume-entry": "var(--resume-space-entry)",
        "resume-inline": "var(--resume-space-inline)",
        "resume-bullet": "var(--resume-space-bullet)",
        "resume-rule": "var(--resume-rule-weight)",
        "resume-rule-gap": "var(--resume-rule-gap)",
        "resume-tag-x": "var(--resume-tag-space-x)",
        "resume-tag-y": "var(--resume-tag-space-y)",
        "resume-icon": "var(--resume-icon-size)"
      },
      width: {
        "resume-page": "var(--resume-page-width)",
        "resume-left-column": "var(--resume-left-column-width)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"]
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        gradient: "var(--gradient)"
      },
      borderRadius: {
        "resume-tag": "var(--resume-tag-radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config

export default config
