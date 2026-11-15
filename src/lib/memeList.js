/** How many memes the gallery loads at a time. */
export const MEME_PAGE = 24;

/**
 * The address of one page of the meme list. Shared by the gallery and by the route registry (which asks for the
 * first page while the gallery's code is still downloading), so both always ask for exactly the same thing and the
 * answer is fetched once.
 */
export function memeListPath({ search = '', type = 'all', sort = 'newest', skip = 0, limit = MEME_PAGE } = {}) {
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip), sort });
  if (search) params.set('search', search);
  if (type !== 'all') params.set('type', type);
  return `/api/memes/list?${params}`;
}
