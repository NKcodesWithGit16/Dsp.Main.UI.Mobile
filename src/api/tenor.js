// Giphy API wrapper for the mobile chat GIF picker.
// Replaces Tenor (discontinued for new keys Jan 2026).
// Env: EXPO_PUBLIC_TENOR_API_KEY — reusing the same env var name so no other files need changing.
// Returns normalized [{ id, title, preview, full, width, height }] shape.

const GIPHY_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY;
const BASE      = 'https://api.giphy.com/v1/gifs';
const RATING    = 'g';

function normalize(item) {
  const images  = item.images || {};
  const full    = images.original;
  const preview = images.fixed_width_small || images.fixed_width || images.original;
  if (!full?.url) return null;
  return {
    id:      item.id,
    title:   item.title || 'GIF',
    preview: preview.url,
    full:    full.url,
    width:   parseInt(preview.width  || full.width  || 200, 10),
    height:  parseInt(preview.height || full.height || 200, 10),
  };
}

export function isTenorConfigured() {
  return Boolean(GIPHY_KEY);
}

export async function searchGifs(query, { limit = 24 } = {}) {
  if (!GIPHY_KEY) throw new Error('EXPO_PUBLIC_TENOR_API_KEY (Giphy key) is not set.');
  if (!query?.trim()) return getTrendingGifs({ limit });
  const url = `${BASE}/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=${limit}&rating=${RATING}&lang=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Giphy search failed (${res.status})`);
  const data = await res.json();
  return (data.data || []).map(normalize).filter(Boolean);
}

export async function getTrendingGifs({ limit = 24 } = {}) {
  if (!GIPHY_KEY) throw new Error('EXPO_PUBLIC_TENOR_API_KEY (Giphy key) is not set.');
  const url = `${BASE}/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=${limit}&rating=${RATING}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Giphy trending failed (${res.status})`);
  const data = await res.json();
  return (data.data || []).map(normalize).filter(Boolean);
}
