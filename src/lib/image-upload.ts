// 服务端权威的图片类型判定:扩展名白名单优先,无扩展名时兜底到已知图片 MIME。
// 客户端自报的 Content-Type 不可信,写入 R2 的 contentType 必须由此处决定,
// 防止伪造 MIME 的非图片内容(如 HTML)被存储后按可执行文档提供给浏览器。
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const MIME_FALLBACKS: Record<string, { extension: string; contentType: string }> = {
  'image/jpeg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/png': { extension: 'png', contentType: 'image/png' },
  'image/gif': { extension: 'gif', contentType: 'image/gif' },
  'image/webp': { extension: 'webp', contentType: 'image/webp' },
  'image/svg+xml': { extension: 'svg', contentType: 'image/svg+xml' },
};

export interface ResolvedImageType {
  extension: string;
  contentType: string;
}

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function resolveImageType(filename: string, mimeType: string): ResolvedImageType | null {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  if (match) {
    const extension = match[1].toLowerCase();
    const contentType = EXTENSION_CONTENT_TYPES[extension];
    // 有扩展名但不在白名单内:直接拒绝,不回退到客户端 MIME
    return contentType ? { extension, contentType } : null;
  }
  // 无扩展名(如部分粘贴上传的文件):仅当 MIME 是已知图片类型时放行
  return MIME_FALLBACKS[mimeType] || null;
}

function hasExpectedSignature(bytes: Uint8Array, type: ResolvedImageType): boolean {
  switch (type.contentType) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        .every((byte, index) => bytes[index] === byte);
    case 'image/gif': {
      const header = new TextDecoder().decode(bytes.slice(0, 6));
      return header === 'GIF87a' || header === 'GIF89a';
    }
    case 'image/webp': {
      const decoder = new TextDecoder();
      return decoder.decode(bytes.slice(0, 4)) === 'RIFF'
        && decoder.decode(bytes.slice(8, 12)) === 'WEBP';
    }
    case 'image/svg+xml': {
      const source = new TextDecoder().decode(bytes.slice(0, 64 * 1024)).trimStart();
      if (!/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(source)) return false;
      return !/<script[\s>]|<foreignObject[\s>]|\son\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript:|data:text\/html)/i.test(source);
    }
    default:
      return false;
  }
}

export async function validateImageFile(file: File): Promise<ResolvedImageType> {
  if (file.size <= 0) throw new Error('Image file is empty');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('File too large. Maximum size is 5MB.');
  const type = resolveImageType(file.name, file.type);
  if (!type) throw new Error('Invalid file type. Allowed extensions: jpg, jpeg, png, gif, webp, svg');
  const bytes = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  if (!hasExpectedSignature(bytes, type)) throw new Error('File content does not match its image type');
  return type;
}
