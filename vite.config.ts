import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 部署在 /badmintonCanvas/ 子路径下
  base: '/badmintonCanvas/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
