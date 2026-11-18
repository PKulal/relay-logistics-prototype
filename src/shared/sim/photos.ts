/** SIMULATED camera pictures: a grey frame with the photo's caption, as an SVG data URI. */
export function photoThumb(caption: string): string {
  const safe = caption.replace(/[<>&"]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#3f3f46"/><rect x="10" y="10" width="140" height="100" rx="6" fill="#5f5f68"/><circle cx="80" cy="52" r="18" fill="none" stroke="#ededef" stroke-width="3"/><text x="80" y="98" fill="#ffffff" font-family="Inter, sans-serif" font-size="11" text-anchor="middle">${safe}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

