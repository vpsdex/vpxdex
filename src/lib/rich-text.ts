import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h2',
  'h3',
  'hr',
  'img',
  'a',
];

export function sanitizeRichText(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }

  const sanitized = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      img: ['src', 'alt', 'title', 'width', 'height'],
      a: ['href', 'title', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  }).trim();

  return sanitized ? sanitized : null;
}

export function richTextToPlainText(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  const text = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}
