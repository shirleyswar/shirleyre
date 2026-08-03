/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─── Legacy tokens (warroom / warroom2) ───────────────────────────────
      colors: {
        'bg-base':     '#0D0F14',
        'bg-card':     '#1A1D27',
        'bg-elevated': '#222632',
        'accent-gold': '#c9933a',
        'accent-gold-light': '#e0b060',
        'text-primary': '#e8e0d0',
        'text-muted':  '#8a8070',
        'success':     '#22C55E',
        'danger':      '#EF4444',

        // ─── Spec §9 tokens (warroom3 / mobile spec) ──────────────────────
        // Surfaces
        base:      '#08080C',
        panel:     '#101017',
        raise:     '#16161F',
        hi:        '#EFEEF4',
        mid:       '#8B8A9B',
        low:       '#5C5B6B',
        invert:    '#0A0A0F',

        // Accents — the four (plus lift) from §2.4
        late:      '#FF4D4D',
        hot:       '#FFA23A',
        moneyIn:   '#34D399',
        brand:     '#8B5CF6',
        brandLift: '#A78BFA',
      },

      fontFamily: {
        // Legacy
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],

        // Spec §9 — loaded via next/font/google as CSS variables
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        code:    ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },

      borderColor: {
        'subtle': 'rgba(255,255,255,0.06)',
      },
      backgroundColor: {
        'subtle': 'rgba(255,255,255,0.03)',
      },

      // Spec §4.2 radius scale
      borderRadius: {
        pill: '4px',
        ctl:  '9px',
        card: '16px',
        hero: '20px',
        sheet: '26px',
      },

      // Spec §4.3 glow — one per screen
      boxShadow: {
        'card':      '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover':'0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
        'gold-glow': '0 0 20px rgba(201,147,58,0.15)',
        'fab':       '0 0 22px rgba(139,92,246,0.40)',
        'glow-late': '0 0 22px rgba(255,77,77,0.40)',
        'glow-money':'0 0 22px rgba(52,211,153,0.40)',
      },

      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'count-up': 'countUp 0.8s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'gold-flash': 'goldFlash 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        goldFlash: {
          '0%': { backgroundColor: '#0D0F14' },
          '40%': { backgroundColor: 'rgba(201,147,58,0.3)' },
          '100%': { backgroundColor: '#0D0F14' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
