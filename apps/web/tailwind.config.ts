import type { Config } from "tailwindcss";
import { branchColors, neutrals, semantic, fonts, radius, motion, shadows } from "./src/design-system/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Forkbot git-branch palette
        forkbot: branchColors,
        // Neutral surface scale
        zinc: {
          950: neutrals[950],
          900: neutrals[900],
          800: neutrals[800],
          700: neutrals[700],
          600: neutrals[600],
          500: neutrals[500],
          400: neutrals[400],
          200: neutrals[200],
          50:  neutrals[50],
        },
        // Semantic shortcuts
        success: semantic.success,
        error:   semantic.error,
        warning: semantic.warning,
        info:    semantic.info,
      },
      fontFamily: {
        heading: fonts.heading.split(", "),
        body:    fonts.body.split(", "),
        mono:    fonts.mono.split(", "),
      },
      borderRadius: radius,
      transitionDuration: {
        fast: motion.fast.replace("ms", ""),
        base: motion.base.replace("ms", ""),
        slow: motion.slow.replace("ms", ""),
      },
      transitionTimingFunction: {
        "ease-entrance": motion.ease,
        "ease-exit":     motion.easeIn,
        spring:          motion.spring,
      },
      boxShadow: {
        xs:  shadows.xs,
        sm:  shadows.sm,
        md:  shadows.md,
        lg:  shadows.lg,
        xl:  shadows.xl,
      },
      animation: {
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        "float":     "float 8s ease-in-out infinite",
        "glow":      "glow 4s ease-in-out infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.4", transform: "scale(0.75)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-20px)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "0.8" },
        },
      },
      typography: {
        DEFAULT: { css: { color: neutrals[200] } },
      },
    },
  },
  plugins: [],
} satisfies Config;
