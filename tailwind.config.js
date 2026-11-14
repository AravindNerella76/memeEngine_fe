/** @type {import('tailwindcss').Config} */
// Design tokens live in src/index.css as CSS variables (RGB triplets) so every colour supports
// Tailwind's opacity syntax (bg-ink/60) and a future dark theme only has to redefine the variables.
const token = name => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        paper: { DEFAULT: token('paper'), 2: token('paper-2') },
        surface: token('surface'),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        muted: token('muted'),
        faint: token('faint'),
        // The brand yellow is the meme's own #FFE500: named like the highlighter it is.
        marker: { DEFAULT: token('marker'), soft: token('marker-soft'), deep: token('marker-deep') },
        ok: { DEFAULT: token('ok'), soft: token('ok-soft') },
        bad: { DEFAULT: token('bad'), soft: token('bad-soft') },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
        // status colours that stay readable on the black sidebar / stage
        live: 'rgb(91 217 138 / <alpha-value>)',
        coral: 'rgb(255 122 112 / <alpha-value>)'
      },
      fontFamily: {
        sans: ['"Instrument Sans"', '"Noto Sans Telugu"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Instrument Sans"', '"Noto Sans Telugu"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        telugu: ['"Noto Sans Telugu"', 'Ramabhadra', 'sans-serif'],
        meme: ['Anton', '"Arial Black"', 'Impact', 'sans-serif']
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }]
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px'
      },
      boxShadow: {
        // "sticker" shadows echo the black outline + drop shadow on the memes themselves
        hard: '3px 3px 0 0 rgb(var(--ink))',
        'hard-sm': '2px 2px 0 0 rgb(var(--ink))',
        'hard-lg': '6px 6px 0 0 rgb(var(--ink))',
        'hard-marker': '6px 6px 0 0 rgb(var(--marker))',
        soft: '0 1px 0 rgb(var(--ink) / 0.04), 0 10px 28px -14px rgb(var(--ink) / 0.22)',
        lift: '0 1px 0 rgb(var(--ink) / 0.05), 0 18px 40px -16px rgb(var(--ink) / 0.32)',
        ring: '0 0 0 3px rgb(var(--marker) / 0.55)'
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: { '0%': { opacity: '0', transform: 'scale(.96) translateY(6px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'slide-in': { from: { opacity: '0', transform: 'translateY(-10px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgb(var(--marker) / .7)' }, '100%': { boxShadow: '0 0 0 10px rgb(var(--marker) / 0)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        stripes: { from: { backgroundPosition: '0 0' }, to: { backgroundPosition: '28px 0' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%': { transform: 'translateX(-8px)' }, '40%': { transform: 'translateX(7px)' }, '60%': { transform: 'translateX(-5px)' }, '80%': { transform: 'translateX(3px)' } },
        float: { '0%,100%': { transform: 'translateY(0) rotate(var(--r, 0deg))' }, '50%': { transform: 'translateY(-6px) rotate(var(--r, 0deg))' } }
      },
      animation: {
        'fade-up': 'fade-up .32s cubic-bezier(.2,.7,.2,1) both',
        'fade-in': 'fade-in .2s ease-out both',
        pop: 'pop .22s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.4s infinite',
        'slide-in': 'slide-in .24s cubic-bezier(.2,.8,.2,1) both',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        marquee: 'marquee 38s linear infinite',
        stripes: 'stripes 1s linear infinite',
        shake: 'shake .42s cubic-bezier(.36,.07,.19,.97) both',
        float: 'float 7s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
