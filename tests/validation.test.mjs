import assert from 'node:assert/strict';
import test from 'node:test';
import { validateImageFile } from '../src/lib/image-upload.ts';
import {
  parseStoredTags,
  serializeTags,
  validateHttpUrl,
  validateRating,
  validateSlug,
} from '../src/lib/validation.ts';

test('provider fields accept valid values and reject unsafe ones', () => {
  assert.equal(validateSlug('香港-vps', 'slug'), '香港-vps');
  assert.equal(validateHttpUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(validateRating('4.5'), 4.5);
  assert.throws(() => validateHttpUrl('javascript:alert(1)'));
  assert.throws(() => validateRating(5.1));
  assert.throws(() => validateSlug('../admin'));
});

test('tags are normalized and malformed stored data fails closed', () => {
  assert.equal(serializeTags('["NVMe", {"zh":"香港","en":"Hong Kong"}]'), '["NVMe",{"zh":"香港","en":"Hong Kong"}]');
  assert.deepEqual(parseStoredTags('{broken'), []);
  assert.throws(() => serializeTags('[{"unknown":"value"}]'));
});

test('image validation checks content signatures', async () => {
  const png = new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
  ], 'logo.png', { type: 'image/png' });
  assert.equal((await validateImageFile(png)).contentType, 'image/png');

  const disguised = new File(['<html>not an image</html>'], 'logo.png', { type: 'image/png' });
  await assert.rejects(() => validateImageFile(disguised));

  const unsafeSvg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'logo.svg', { type: 'image/svg+xml' });
  await assert.rejects(() => validateImageFile(unsafeSvg));
});
