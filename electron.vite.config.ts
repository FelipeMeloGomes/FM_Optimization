import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import visualizer from 'rollup-plugin-visualizer'

export default defineConfig({
  main: {
    build: {
      // externalizeDeps já vem ativo por padrão na v5/v6:
      // só o que está em "dependencies" (electron-updater, systeminformation, zod)
      // fica fora do bundle. Não use bytecode: aumentaria o app.asar de 6,8 MB.
      rolldownOptions: {
        input: { index: resolve(__dirname, 'electron/main/index.ts') }
      }
    }
  },
  preload: {
    build: {
      rolldownOptions: {
        input: { index: resolve(__dirname, 'electron/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: '.',
    resolve: {
      // Lê os "paths" do tsconfig (default é desligado no Vite 8).
      // Requer "@/*" declarado no tsconfig usado pelo renderer.
      tsconfigPaths: true,
      // O react-router@7 expõe dist/development/ por padrão (sem condição
      // de produção nos exports). Força a pasta production para eliminar
      // código de dev (~90 KB no bundle).
      alias: [
        // O react-router@7 expõe dist/development/ por padrão (sem condição
        // de produção nos exports). Força a pasta production para eliminar
        // código de dev (~90 KB no bundle).
        { find: 'react-router/dom', replacement: resolve(__dirname, 'node_modules/react-router/dist/production/dom-export.mjs') },
        { find: 'react-router', replacement: resolve(__dirname, 'node_modules/react-router/dist/production/index.mjs') },
      ],
    },
    // Força NODE_ENV=production para que o react-router (e outros pacotes)
    // eliminem código de desenvolvimento por tree-shaking.
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    build: {
      // Fontes nunca como data: URI — o CSP (`font-src 'self'`) bloqueia.
      assetsInlineLimit: (filePath) => (filePath.endsWith('.woff2') ? false : undefined),
      rolldownOptions: {
        input: { index: resolve(__dirname, 'index.html') },
        output: {
          // Oxc é o minificador padrão no Vite 8. Remove console.* do build de produção.
          minify: { compress: { dropConsole: true } },
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/
              },
              { name: 'radix', test: /node_modules[\\/]@radix-ui[\\/]/ },
              { name: 'lucide', test: /node_modules[\\/]lucide-react[\\/]/ }
            ]
          }
        }
      }
    },
    plugins: [react(), tailwindcss(), visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'renderer-stats.html',
    })]
  }
})
