import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { validateImageFile } from '../../../lib/image-upload';

// Upload image to R2 and return the URL
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resolvedType = await validateImageFile(file);

    // Generate unique filename
    const timestamp = Date.now();
    const random = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    const filename = `editor-images/${timestamp}-${random}.${resolvedType.extension}`;

    // Upload to R2 using native Cloudflare API
    const arrayBuffer = await file.arrayBuffer();
    await env.R2.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: resolvedType.contentType,
      },
    });

    // Return the URL
    const imageUrl = `/api/image/${filename}`;

    return new Response(JSON.stringify({ url: imageUrl, filename }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to upload image' }), {
      status: error instanceof Error ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
