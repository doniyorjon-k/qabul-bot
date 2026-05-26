import twemoji from '@twemoji/api'

const OPTS = { folder: 'svg', ext: '.svg', className: 'twemoji' }

export function parseEmoji(text) {
  return twemoji.parse(String(text), OPTS)
}

export function parseTextWithBold(text) {
  return text
    .split('\n')
    .map(line => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return parts
        .map((p, i) => {
          const withEmoji = twemoji.parse(p, OPTS)
          return i % 2 === 1 ? `<strong>${withEmoji}</strong>` : withEmoji
        })
        .join('')
    })
    .join('<br/>')
}
