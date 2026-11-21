import { API_BASE, apiFetch } from '../api';

/**
 * iPhone photos (HEIC/HEIF). Only Safari can display them, so the studio turns one into an ordinary JPEG the moment it
 * is picked (the server converts it: POST /api/images/convert). Everything after that (preview, frame choice, upload)
 * sees a normal picture. Windows and Android browsers often give these files no type, so the name decides too.
 */

/** For <input type="file" accept>: the picture types the studio takes, iPhone photos included. */
export const ACCEPT_PICTURES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.jfif,.png,.webp,.heic,.heif';

export const isHeicFile = file => Boolean(file) && (/^image\/hei[cf](-sequence)?$/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || ''));

/** A picture the studio can take: any image type, or an iPhone photo without a type. */
export const isPictureFile = file => Boolean(file) && (/^image\//.test(file.type || '') || isHeicFile(file));

/**
 * The same picture as something every browser can show. Non-HEIC files come back untouched. Throws an Error with a
 * readable message when the photo cannot be converted.
 */
export async function toBrowserImage(file) {
  if (!isHeicFile(file)) return file;
  const form = new FormData();
  form.append('image', file, file.name || 'photo.heic');
  let res;
  try {
    res = await apiFetch(`${API_BASE}/api/images/convert`, { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach the server to convert this iPhone photo. Check the connection and try again.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error('This server is an older version that cannot convert iPhone photos yet. Restart it after updating, or save the photo as JPG.');
    throw new Error(data.message || `The iPhone photo could not be converted (status ${res.status}).`);
  }
  const blob = await res.blob();
  const ext = blob.type === 'image/png' ? '.png' : '.jpg';
  const base = (file.name || 'photo').replace(/\.hei[cf]$/i, '');
  return new File([blob], `${base}${ext}`, { type: blob.type || 'image/jpeg', lastModified: file.lastModified || Date.now() });
}

/** Converts every HEIC in a list (one at a time: decoding is heavy). Returns { files, failed: [{ name, reason }] }. */
export async function toBrowserImages(list) {
  const files = [];
  const failed = [];
  for (const f of list) {
    try {
      files.push(await toBrowserImage(f));
    } catch (e) {
      failed.push({ name: f.name, reason: e.message });
    }
  }
  return { files, failed };
}
