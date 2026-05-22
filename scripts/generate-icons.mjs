// Run: node scripts/generate-icons.mjs
// Gera ícones SVG simples para PWA
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#111210"/>
  <text
    x="${size / 2}"
    y="${size * 0.57}"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="${size * 0.58}"
    font-weight="600"
    fill="#E8A547"
  >G</text>
</svg>`

writeFileSync(join(__dirname, '../public/icons/icon-192.svg'), svg(192))
writeFileSync(join(__dirname, '../public/icons/icon-512.svg'), svg(512))
console.log('SVG icons generated in public/icons/')
