import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // 使用 'class' 模式：在 <html> 加上 class="dark" 即啟用暗色主題
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'nomad-navy':  '#1B3A5C',
        'nomad-blue':  '#2563EB',
        'nomad-light': '#DBEAFE',
      }
    },
  },
  plugins: [],
}

export default config
