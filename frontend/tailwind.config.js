/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // Design Guide: Brand Colors with full scales
        primary: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        secondary: {
          DEFAULT: "#8b5cf6",
          foreground: "#ffffff",
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        accent: {
          DEFAULT: "#06b6d4",
          foreground: "#ffffff",
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
        success: {
          DEFAULT: "#22c55e",
          foreground: "#ffffff",
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        error: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },
        info: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },

        // Keep shadcn compatibility
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Fira Code", "ui-monospace", "SFMono-Regular", "monospace"],
        manrope: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Brand Design System Utilities
      backgroundImage: {
        'grid-pattern': `
          radial-gradient(circle at 50% 50%, #d1d5db 2px, transparent 2px),
          linear-gradient(to right, #e5e7eb 1px, transparent 1px),
          linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
        `,
        'grid-pattern-dark': `
          radial-gradient(circle at 50% 50%, #374151 2px, transparent 2px),
          linear-gradient(to right, #4b5563 1px, transparent 1px),
          linear-gradient(to bottom, #4b5563 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid': '48px 48px, 48px 48px, 48px 48px',
      },
      backgroundPosition: {
        'grid': '24px 24px, 0 0, 0 0',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in-up-delay': 'fadeInUp 0.6s ease-out 0.2s both',
      },
      keyframes: {
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    function({ addUtilities, addComponents, theme }) {
      addUtilities({
        // Grid Background Utilities
        '.bg-grid': {
          backgroundImage: `
            radial-gradient(circle at 50% 50%, #d1d5db 2px, transparent 2px),
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px, 48px 48px, 48px 48px',
          backgroundPosition: '24px 24px, 0 0, 0 0',
        },
        '.bg-grid-dark': {
          '@apply dark:bg-none': {},
          '@apply dark:bg-grid-pattern-dark': {},
        },
        '.bg-grid-opacity': {
          '@apply opacity-30 dark:opacity-20': {},
        },
      });

      addComponents({
        // Brand Icon Container
        '.icon-container': {
          '@apply w-12 h-12 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center': {},
        },
        '.icon-container-sm': {
          '@apply w-8 h-8 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center': {},
        },
        '.icon-container-lg': {
          '@apply w-16 h-16 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center': {},
        },

        // Brand Icon Styling
        '.brand-icon': {
          '@apply h-6 w-6 text-white dark:text-gray-900': {},
        },
        '.brand-icon-sm': {
          '@apply h-4 w-4 text-white dark:text-gray-900': {},
        },
        '.brand-icon-lg': {
          '@apply h-8 w-8 text-white dark:text-gray-900': {},
        },

        // Brand Card Styling
        '.brand-card': {
          '@apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow': {},
        },

        // Brand Text Colors
        '.text-brand-primary': {
          '@apply text-gray-900 dark:text-white': {},
        },
        '.text-brand-secondary': {
          '@apply text-gray-600 dark:text-gray-400': {},
        },

        // Brand Container
        '.brand-container': {
          '@apply max-w-4xl mx-auto px-4 sm:px-6 lg:px-8': {},
        },
        '.brand-container-wide': {
          '@apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8': {},
        },

        // Brand Section with Grid Background
        '.brand-section': {
          '@apply pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden': {},
        },
        '.brand-grid-bg': {
          '@apply absolute inset-0 opacity-30 dark:opacity-20': {},
          backgroundImage: `
            radial-gradient(circle at 50% 50%, #d1d5db 2px, transparent 2px),
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px, 48px 48px, 48px 48px',
          backgroundPosition: '24px 24px, 0 0, 0 0',
        },

        // Brand Typography
        '.brand-heading-xl': {
          '@apply text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white font-manrope': {},
        },
        '.brand-heading-lg': {
          '@apply text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white font-manrope': {},
        },
        '.brand-heading-md': {
          '@apply text-2xl md:text-3xl font-bold text-gray-900 dark:text-white font-manrope': {},
        },
        '.brand-text-lg': {
          '@apply text-lg md:text-xl text-gray-600 dark:text-gray-400 font-manrope': {},
        },
        '.brand-text': {
          '@apply text-gray-600 dark:text-gray-400 font-manrope': {},
        },
      });
    }
  ],
};
