/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Telegram for Android (light / night) ────────────────────────────────────
           Values live in CSS variables (src/index.css) as RGB triplets: light
           by default, Telegram night under <html data-theme="dark">. The
           <alpha-value> placeholder keeps every /10 opacity modifier working.
           page    = grouped page background
           surface = bars, cards, sheets
           surface2= subtle fills, inputs, pressed rows
           navy    = tinted band (footer, tiles)
           line    = hairline separators
           neon    = the single accent, spent only on real actions
        ─────────────────────────────────────────────────────────────────── */
        page: "rgb(var(--c-page) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        navy: "rgb(var(--c-navy) / <alpha-value>)",
        neon: "rgb(var(--c-neon) / <alpha-value>)",
        sky: "rgb(var(--c-sky) / <alpha-value>)",
        teal: "rgb(var(--c-teal) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        locked: "rgb(var(--c-locked) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        warn: "rgb(var(--c-warn) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Vazirmatn Variable", "Vazirmatn", "Tahoma", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "10px",
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
        "glow-sm": "var(--shadow-glow-sm)",
        card: "var(--shadow-card)",
        bar: "var(--shadow-bar)",
        /* the floating, translucent Telegram bottom bar */
        float: "var(--shadow-float)",
      },
      animation: {
        "fade-in": "fadeIn .35s ease both",
        "slide-up": "slideUp .4s ease both",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".55" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};
