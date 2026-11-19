/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        kid: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#FFF8EC',
        ink: '#3B2F5C',
        sunny: { 100: '#FFF4CC', 300: '#FFE07A', 400: '#FFD23F', 500: '#F7B500' },
        bubblegum: { 100: '#FFE3EE', 300: '#FF9EC4', 400: '#FF7BAC', 500: '#F0548E' },
        sky: { 100: '#DDF3FF', 300: '#8FD3FF', 400: '#5BBCFF', 500: '#2E9BF0' },
        mint: { 100: '#DDF8EC', 300: '#8BE3BC', 400: '#4FD08F', 500: '#22B573' },
        grape: { 100: '#EEE5FF', 300: '#C3A6FF', 400: '#A07BFF', 500: '#7C55E6' },
        peach: { 100: '#FFE9DC', 300: '#FFBE98', 400: '#FF9E66', 500: '#F77F3B' },
      },
      boxShadow: {
        pop: '0 8px 0 0 rgba(59,47,92,0.15)',
        'pop-sm': '0 4px 0 0 rgba(59,47,92,0.15)',
        soft: '0 10px 30px -10px rgba(59,47,92,0.25)',
      },
      borderRadius: {
        blob: '2rem',
        '4xl': '2.5rem',
      },
    },
  },
  plugins: [],
};
