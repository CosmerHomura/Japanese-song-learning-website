import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: { __UTA_BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  // Local folder songs exist only in development, never in release artifacts.
  publicDir: command === 'serve' ? 'song' : false,
  resolve: { alias: command === 'build' ? [{
    find: /^(?:.*\/)?songs\.generated(?:\.js)?$/,
    replacement: fileURLToPath(new URL('./src/data/songs.release.js', import.meta.url)),
  }] : [] },
}))
