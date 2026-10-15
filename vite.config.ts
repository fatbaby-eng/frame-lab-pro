import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// GitHub Pages serves from /frame-lab-pro/; toddboswell.com serves the same
// build from /framelab/. `FL_BASE=/framelab/ npm run build` makes the site copy.
export default defineConfig({
  base: process.env.FL_BASE || '/frame-lab-pro/',
  plugins: [react(), tailwindcss()],
})
