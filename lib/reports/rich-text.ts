export const MAX_TOP_HEADER_HTML = 2000
export const MAX_FOOTER_NOTES_HTML = 4000

export const truncateRichText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLength)
}

export const sanitizeRichTextHtml = (raw: string, maxLength = MAX_FOOTER_NOTES_HTML) => {
  if (!raw) return ''
  const trimmed = raw.slice(0, maxLength)
  const withoutScripts = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  const allowedTags = new Set([
    'b',
    'strong',
    'i',
    'em',
    'u',
    'mark',
    'span',
    'font',
    'br',
    'p',
    'div',
  ])
  const allowedStyleProps = new Set([
    'color',
    'background-color',
    'font-size',
    'font-weight',
    'font-style',
    'text-decoration',
    'text-align',
  ])

  const fontSizeMap: Record<string, string> = {
    '1': '10px',
    '2': '12px',
    '3': '14px',
    '4': '16px',
    '5': '18px',
    '6': '24px',
    '7': '32px',
  }

  return withoutScripts.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase()
    if (!allowedTags.has(tag)) return ''
    const normalizedTag = tag === 'font' ? 'span' : tag
    const isClosing = match.startsWith('</')
    if (isClosing) return `</${normalizedTag}>`
    if (tag === 'br') return '<br />'

    const styleSegments: string[] = []
    if (tag === 'font') {
      const sizeMatch = String(rawAttrs || '').match(/\ssize\s*=\s*["']?([1-7])["']?/i)
      if (sizeMatch?.[1] && fontSizeMap[sizeMatch[1]]) {
        styleSegments.push(`font-size: ${fontSizeMap[sizeMatch[1]]}`)
      }
      const colorMatch = String(rawAttrs || '').match(/\scolor\s*=\s*["']?([^"'\s>]+)["']?/i)
      if (colorMatch?.[1] && !/javascript:/i.test(colorMatch[1])) {
        styleSegments.push(`color: ${colorMatch[1]}`)
      }
    }

    const styleMatch = String(rawAttrs || '').match(/\sstyle\s*=\s*["']([^"']*)["']/i)
    if (!styleMatch && styleSegments.length === 0) return `<${normalizedTag}>`

    const cleanStyles = (styleMatch ? styleMatch[1].split(';') : [])
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [propRaw, ...valueParts] = part.split(':')
        const prop = (propRaw || '').trim().toLowerCase()
        if (!allowedStyleProps.has(prop)) return null
        const value = valueParts.join(':').trim()
        if (!value || /url\(|expression\(|javascript:/i.test(value)) return null
        return `${prop}: ${value}`
      })
      .filter(Boolean) as string[]

    const mergedStyles = [...styleSegments, ...cleanStyles]
    return mergedStyles.length > 0
      ? `<${normalizedTag} style="${mergedStyles.join('; ')}">`
      : `<${normalizedTag}>`
  })
}

export const htmlToPlainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim()

export const hasRichTextContent = (html: string) => htmlToPlainText(html).length > 0

export const normalizeRichTextForCompare = (html: string) =>
  sanitizeRichTextHtml(html, MAX_FOOTER_NOTES_HTML)
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()

export const formatGeneratedAt = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
