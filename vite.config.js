import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'

// Os CSVs são usados para gerar arquivos JSON menores por categoria.
// Não os publique duplicados no build final; mantenha-os no repositório.
const trimRawCatalogFromBuild = {
  name: 'trim-raw-catalog-from-build',
  apply: 'build',
  async closeBundle() {
    const catalogDir = path.resolve('dist/catalogo/filmesseries')
    let files = []
    try {
      files = await fs.readdir(catalogDir)
    } catch {
      return
    }
    await Promise.all(
      files
        .filter((file) => /^catalogo_estruturado_parte_\d+\.csv$/i.test(file))
        .map((file) => fs.rm(path.join(catalogDir, file), { force: true }))
    )
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), trimRawCatalogFromBuild],
})
