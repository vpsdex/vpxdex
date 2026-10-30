import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireApiAuth, jsonResponse, handleCors } from '../../../lib/api-auth';
import { validateImageFile } from '../../../lib/image-upload';

// POST /api/v1/upload - 上传图片到 R2
// 表单字段:
//   image:  图片文件（必填，jpg/png/gif/webp/svg，最大 5MB）
//   type:   图片类型（可选，"logo"、"activity" 或 "editor"，默认 "editor"）
//           - "logo":   存储到 logos/ 目录，返回 logo_key（用于服务商 Logo）
//           - "editor": 存储到 editor-images/ 目录，返回 url（用于富文本内容插图）
export const POST: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const type = (formData.get('type') as string) || 'editor';

    if (!file) {
      return jsonResponse({ error: 'No file uploaded. Provide an "image" field.' }, 400);
    }

    const resolvedType = await validateImageFile(file);

    const allowedTypes = ['logo', 'activity', 'editor'];
    if (!allowedTypes.includes(type)) {
      return jsonResponse({ error: `Invalid type "${type}". Must be "logo", "activity" or "editor".` }, 400);
    }

    const timestamp = Date.now();
    const random = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    // Logo 存到 logos/ 前缀（由 /api/logo/ 端点服务），编辑器图片存到 editor-images/（由 /api/image/ 端点服务）
    const prefix = type === 'logo' ? 'logos' : type === 'activity' ? 'activity-images' : 'editor-images';
    const filename = `${prefix}/${timestamp}-${random}.${resolvedType.extension}`;

    await env.R2.put(filename, await file.arrayBuffer(), {
      httpMetadata: { contentType: resolvedType.contentType },
    });

    // 根据类型返回不同的访问路径
    if (type === 'logo') {
      return jsonResponse({
        logo_key: filename,
        logo_url: `/api/logo/${filename}`,
        filename,
      }, 201);
    }

    if (type === 'activity') {
      return jsonResponse({
        featured_image_key: filename,
        url: `/api/image/${filename}`,
        filename,
      }, 201);
    }

    return jsonResponse({
      url: `/api/image/${filename}`,
      filename,
    }, 201);
  } catch (error) {
    console.error('API upload error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to upload image' }, error instanceof Error ? 400 : 500);
  }
};
