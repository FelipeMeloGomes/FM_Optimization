import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      // Fontes nunca podem ser embutidas como data: URI — o CSP do renderer
      // (`font-src 'self'` em index.html) bloqueia o esquema data:.
      // Sem isto, qualquer .woff2 abaixo de 4 KB vira uma @font-face morta.
      assetsInlineLimit: (filePath) => (filePath.endsWith('.woff2') ? false : undefined),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        },
        output: {
          // Vite 8 usa Rolldown: o formato objeto de `manualChunks` (Rollup)
          // não existe mais. `codeSplitting.groups` é o equivalente atual e
          // mantém os mesmos chunks de vendor estáveis para cache.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              },
              { name: 'radix', test: /node_modules[\\/]@radix-ui[\\/]/ },
              { name: 'lucide', test: /node_modules[\\/]lucide-react[\\/]/ },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
