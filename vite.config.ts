import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function depsPlugin() {
  const virtualId = 'virtual:deps'
  const resolvedId = '\0' + virtualId

  return {
    name: 'deps-versions',
    resolveId(id: string) {
      if (id === virtualId) return resolvedId
    },
    load(id: string) {
      if (id !== resolvedId) return

      const pkgJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
      const cargoLock = readFileSync(resolve(__dirname, 'src-tauri/Cargo.lock'), 'utf-8')

      const cargoVersions: Record<string, string> = {}
      const re = /name = "([^"]+)"\nversion = "([^"]+)"/g
      let m
      while ((m = re.exec(cargoLock))) {
        cargoVersions[m[1]] = m[2]
      }

      const deps = [
        { name: 'Tauri', version: cargoVersions['tauri'] ?? 'unknown' },
        { name: 'ldap3', version: cargoVersions['ldap3'] ?? 'unknown' },
        { name: 'native-tls', version: cargoVersions['native-tls'] ?? 'unknown' },
        { name: 'security-framework', version: cargoVersions['security-framework'] ?? 'unknown' },
        { name: 'tokio', version: cargoVersions['tokio'] ?? 'unknown' },
        { name: 'React', version: pkgJson.dependencies?.react?.replace('^', '') ?? 'unknown' },
        { name: 'Vite', version: pkgJson.devDependencies?.vite?.replace('^', '') ?? 'unknown' },
        { name: 'TypeScript', version: pkgJson.devDependencies?.typescript?.replace('^', '') ?? 'unknown' },
      ]

      return `export const appVersion = ${JSON.stringify(pkgJson.version ?? 'unknown')};\nexport const deps = ${JSON.stringify(deps)};`
    },
  }
}

export default defineConfig({
  plugins: [depsPlugin()],
  esbuild: {
    jsx: 'automatic',
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
