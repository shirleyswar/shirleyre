/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
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
        // Custom border-subtle via CSS variable / arbitrary value
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderColor: {
        'subtle': 'rgba(255,255,255,0.06)',
      },
      backgroundColor: {
        'subtle': 'rgba(255,255,255,0.03)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
        'gold-glow': '0 0 20px rgba(201,147,58,0.15)',
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
