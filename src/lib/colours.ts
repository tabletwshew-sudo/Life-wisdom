/**
 * Personal colours. Based on the Okabe–Ito colour-blind-safe palette plus a few
 * extras. Colour is never the only signal: people also have an emoji and name,
 * and statuses always have an icon.
 */
export const PALETTE = [
  { hex: '#0072B2', name: 'Blue' },
  { hex: '#E69F00', name: 'Orange' },
  { hex: '#009E73', name: 'Green' },
  { hex: '#CC79A7', name: 'Pink' },
  { hex: '#D55E00', name: 'Red' },
  { hex: '#56B4E9', name: 'Sky' },
  { hex: '#7B61FF', name: 'Purple' },
  { hex: '#F0C808', name: 'Yellow' },
  { hex: '#1B998B', name: 'Teal' },
  { hex: '#E5446D', name: 'Raspberry' },
] as const

export function colourName(hex: string): string {
  return PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex
}

/** Pick black or white text for the best contrast on a given background. */
export function readableTextOn(hex: string): '#000000' | '#ffffff' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#000000'
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  // Compare contrast against black (lum+0.05)/0.05 vs white 1.05/(lum+0.05)
  return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? '#000000' : '#ffffff'
}

/** A soft tint of a colour for backgrounds (works in light and dark mode). */
export function tint(hex: string, alpha = 0.16): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 'transparent'
  const n = parseInt(m[1], 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`
}
