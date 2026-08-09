/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#070B14",
        surface: "#0D1422",
        surface2: "#121C2E",
        navy: "#101A2B",
        neon: "#2F8CFF",
        sky: "#57B8FF",
        teal: "#20D6B5",
        text: "#F5F7FA",
        muted: "#9AA8BA",
        line: "#223149",
        locked: "#667085",
        danger: "#F0445B",
        warn: "#F5A623",
      },
      fontFamily: {
        sans: ["Vazirmatn Variable", "Vazirmatn", "Tahoma", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      boxShadow: {
        glow: "0 0 24px rgba(47, 140, 255, 0.22)",
        "glow-sm": "0 0 14px rgba(47, 140, 255, 0.18)",
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 28px rgba(0,0,0,0.35)",
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
