'use client'

/**
 * Reduz uma foto no aparelho antes de mandar para a IA: lado maior até 1600px, JPEG 82%.
 * Uma foto de celular de 4–8MB vira algo entre 200 e 600KB — cabe no limite da Vercel (4,5MB).
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  const source = bitmap ?? (await loadImage(file))
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height
  const scale = Math.min(1, maxSide / Math.max(w, h))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  ctx.fillStyle = '#fff' // PNG transparente vira fundo branco, melhor para leitura
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  bitmap?.close()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img) }
    img.onerror = () => reject(new Error('imagem ilegível'))
    img.src = URL.createObjectURL(file)
  })
}
