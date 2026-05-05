/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-container': 'var(--color-surface-container)',
        'surface-container-low': 'var(--color-surface-container-low)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'surface-container-highest': 'var(--color-surface-container-highest)',
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        primary: 'var(--color-primary)',
        'primary-container': 'var(--color-primary-container)',
        'on-primary': 'var(--color-on-primary)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        outline: 'var(--color-outline)',
        'outline-variant': 'var(--color-outline-variant)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
