import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Because the site will be served at /Matrix_Path/
  base: '/Matrix_Path/',
})
