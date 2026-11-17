/** Only same-site paths or http(s) links: a setting can't turn into a javascript: link. */
export function safeAdLink(link: string): { internal: boolean; href: string } | null {
  const href = link.trim()
  if (href.startsWith('/') && !href.startsWith('//')) return { internal: true, href }
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? { internal: false, href: url.toString() } : null
  } catch {
    return null
  }
}
