import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    // .env.local의 Supabase 키를 RLS smoke test에서 사용
    env: (() => {
      try {
        const fs = require('fs')
        const envFile = fs.readFileSync('.env.local', 'utf-8')
        return Object.fromEntries(
          envFile.split('\n')
            .filter((line: string) => line && !line.startsWith('#') && line.includes('='))
            .map((line: string) => {
              const [key, ...rest] = line.split('=')
              return [key.trim(), rest.join('=').trim()]
            })
        )
      } catch {
        return {}
      }
    })(),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
