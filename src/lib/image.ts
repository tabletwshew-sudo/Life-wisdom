/**
 * Shrinks a photo before upload (max 1600px, JPEG ~80%). A typical iPhone
 * photo goes from ~3 MB to ~250 KB, which keeps well inside the free storage.
 */
export async function compressImage(file: File, maxSize = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('That photo couldn’t be opened. Try a JPEG or PNG.')
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('Couldn’t prepare that photo')
  return blob
}
