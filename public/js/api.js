const DEFAULT_RENDER_API_BASE = 'https://music-inspector.onrender.com';

function isAllowedApiOverride(urlString) {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('onrender.com');
  } catch {
    return false;
  }
}

function resolveApiBase() {
  const host = window.location.hostname;
  const override = window.localStorage.getItem('MI_API_BASE');

  if (override) {
    const normalizedOverride = override.replace(/\/$/, '');
    if (isAllowedApiOverride(normalizedOverride)) {
      return normalizedOverride;
    }

    try {
      window.localStorage.removeItem('MI_API_BASE');
    } catch {
      // Ignore storage errors silently
    }
  }

  if (host === 'localhost' || host === '127.0.0.1') return '';
  if (host.endsWith('onrender.com')) return '';

  return DEFAULT_RENDER_API_BASE;
}

export const API_BASE = resolveApiBase();
let csrfTokenCache = '';

function cleanupLegacyCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('MI_CACHE')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors silently
  }
}

cleanupLegacyCache();

export function withApiUrl(path) {
  return `${API_BASE}${path}`;
}

function isAbsoluteMediaUrl(value) {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('//')
  );
}

function normalizeStoredMediaPath(path) {
  const raw = String(path || '').trim().replace(/\\/g, '/');
  if (!raw) {
    return '';
  }

  const marker = '/public/';
  const lowered = raw.toLowerCase();
  const markerIndex = lowered.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return raw.slice(markerIndex + marker.length);
  }

  if (lowered.startsWith('/public/')) {
    return raw.slice('/public/'.length);
  }

  if (lowered.startsWith('public/')) {
    return raw.slice('public/'.length);
  }

  return raw.replace(/^\.\//, '');
}

function rewriteLegacyUploadPrefix(value) {
  if (!value) {
    return '';
  }

  if (value.startsWith('/api/uploads/')) {
    return `/uploads/${value.slice('/api/uploads/'.length)}`;
  }

  if (value.startsWith('api/uploads/')) {
    return `uploads/${value.slice('api/uploads/'.length)}`;
  }

  if (value.startsWith('/public/uploads/')) {
    return `/uploads/${value.slice('/public/uploads/'.length)}`;
  }

  if (value.startsWith('public/uploads/')) {
    return `uploads/${value.slice('public/uploads/'.length)}`;
  }

  return value;
}

function normalizeLegacyUploadPath(path, folderName) {
  const normalized = rewriteLegacyUploadPrefix(normalizeStoredMediaPath(path));
  if (!normalized || isAbsoluteMediaUrl(normalized)) {
    return normalized;
  }

  const value = normalized.replace(/^\/+/, '');
  if (!value) {
    return '';
  }

  if (value.startsWith('uploads/')) {
    return value;
  }

  if (value.startsWith(`${folderName}/`)) {
    return `uploads/${value}`;
  }

  if (!value.includes('/')) {
    return `uploads/${folderName}/${value}`;
  }

  return value;
}

export function resolveMediaUrl(path) {
  if (!path) {
    return '';
  }

  const value = rewriteLegacyUploadPrefix(normalizeStoredMediaPath(path));
  if (!value) {
    return '';
  }

  if (isAbsoluteMediaUrl(value)) {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const parsed = new URL(value);
        const rewrittenPath = rewriteLegacyUploadPrefix(parsed.pathname);
        if (rewrittenPath !== parsed.pathname) {
          parsed.pathname = rewrittenPath;
          return parsed.toString();
        }
      } catch {
        // Ignore URL parsing errors and fallback to original value
      }
    }

    if (value.includes('api.dicebear.com') && value.includes('/svg')) {
      return value.replace('/svg', '/png');
    }

    return value;
  }

  if (
    value.startsWith('svg/') ||
    value.startsWith('logos/') ||
    value.startsWith('people/') ||
    value.startsWith('traks/')
  ) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return withApiUrl(normalized);
}

export function resolveCoverUrl(path) {
  return resolveMediaUrl(normalizeLegacyUploadPath(path, 'covers'));
}

export function resolveAvatarUrl(path) {
  return resolveMediaUrl(normalizeLegacyUploadPath(path, 'avatars'));
}

export function resolveArtistUrl(path) {
  return resolveMediaUrl(normalizeLegacyUploadPath(path, 'artists'));
}

export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function fetchCsrfTokenFromApi() {
  try {
    const response = await fetch(withApiUrl('/api/csrf-token'), { credentials: 'include' });
    if (!response.ok) {
      return '';
    }

    const data = await response.json().catch(() => ({}));
    const token = typeof data.csrfToken === 'string' ? data.csrfToken : '';
    if (token) {
      csrfTokenCache = token;
    }
    return token;
  } catch {
    return '';
  }
}

async function resolveCsrfToken() {
  const cookieToken = getCsrfToken();
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }

  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  return fetchCsrfTokenFromApi();
}

function isSafeMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function clearPublicCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('MI_CACHE')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors silently
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  return response.text().catch(() => '');
}

async function parseErrorResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const errorData = await response.json().catch(() => ({}));
    return errorData.error || fallbackMessage;
  }

  const bodyText = await response.text().catch(() => '');
  if (bodyText.includes('Vercel Security Checkpoint') || response.headers.get('x-vercel-mitigated')) {
    return 'Vercel Security Checkpoint блокирует API. Используйте Render API для продакшена.';
  }

  return fallbackMessage;
}

async function apiRequest(path, options = {}, fallbackMessage = 'Request failed') {
  const requestOptions = {
    credentials: 'include',
    ...options
  };

  const method = (requestOptions.method || 'GET').toUpperCase();
  if ((method === 'GET' || method === 'HEAD') && !requestOptions.cache) {
    requestOptions.cache = 'no-store';
  }

  if (!isSafeMethod(method)) {
    const csrfToken = await resolveCsrfToken();
    if (csrfToken) {
      const headers = new Headers(requestOptions.headers || {});
      headers.set('x-csrf-token', csrfToken);
      requestOptions.headers = headers;
    }
  }

  const response = await fetch(withApiUrl(path), requestOptions);

  if (!response.ok) {
    const message = await parseErrorResponse(response, fallbackMessage);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const body = await parseResponseBody(response);
  return body;
}

export async function getTopReleases() {
  try {
    const data = await apiRequest('/api/tracks/top-releases', {}, 'Failed to fetch top releases');
    return data.releases || data.albums || [];
  } catch (error) {
    console.error('Error fetching top releases:', error);

    // Backward compatibility fallback for older backend deployments
    try {
      const fallbackData = await apiRequest('/api/tracks/monthly-albums', {}, 'Failed to fetch monthly albums');
      return fallbackData.releases || fallbackData.albums || [];
    } catch (fallbackError) {
      console.error('Fallback top releases fetch failed:', fallbackError);
      return [];
    }
  }
}

export async function getMonthlyAlbums() {
  return getTopReleases();
}

export async function getReleases() {
  try {
    const data = await apiRequest('/api/tracks/latest', {}, 'Failed to fetch releases');
    return data.tracks || [];
  } catch (error) {
    console.error('Error fetching releases:', error);
    return [];
  }
}

export async function getReviews() {
  try {
    const data = await apiRequest('/api/reviews/latest', {}, 'Failed to fetch reviews');
    return data.reviews || [];
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

export async function getReview(id) {
  try {
    const data = await apiRequest(`/api/reviews/by-track/${id}`, {}, 'Failed to fetch review');
    return data.reviews?.[0] || null;
  } catch (error) {
    console.error('Error fetching review:', error);
    return null;
  }
}

export async function getTrack(id) {
  try {
    return await apiRequest(`/api/tracks/${id}`, {}, 'Failed to fetch track');
  } catch (error) {
    console.error('Error fetching track:', error);
    throw error;
  }
}

export async function getReviewsByTrack(trackId) {
  try {
    return await apiRequest(`/api/reviews/by-track/${trackId}`, {}, 'Failed to fetch reviews');
  } catch (error) {
    console.error('Error fetching reviews:', error);
    if (error.name === 'TypeError' && String(error.message).includes('fetch')) {
      const networkError = new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.');
      networkError.status = 0;
      throw networkError;
    }
    throw error;
  }
}

export async function addReview(reviewData) {
  try {
    const result = await apiRequest('/api/reviews/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    }, 'Failed to add review');
    clearPublicCache();
    return result;
  } catch (error) {
    console.error('Error adding review:', error);
    throw error;
  }
}

export async function voteReview(reviewId, vote) {
  try {
    const result = await apiRequest(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    }, 'Failed to submit vote');
    clearPublicCache();
    return result;
  } catch (error) {
    console.error('Vote review error:', error);
    throw error;
  }
}

export async function generateMIReview(data) {
  try {
    return await apiRequest('/api/mi-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, 'Failed to generate review');
  } catch (error) {
    console.error('Error generating MI review:', error);
    throw error;
  }
}

export async function login(credentials) {
  try {
    return await apiRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }, 'Login failed');
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function register(payload) {
  try {
    return await apiRequest('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 'Registration failed');
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const data = await apiRequest('/api/user/current', {}, 'Failed to fetch current user');
    return data.user || null;
  } catch (error) {
    return null;
  }
}

export async function updateMyName(name) {
  try {
    const result = await apiRequest('/api/user/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }, 'Failed to update name');

    clearPublicCache();
    return result;
  } catch (error) {
    console.error('Update name error:', error);
    throw error;
  }
}

export async function getPublicUserProfile(userId) {
  try {
    return await apiRequest(`/api/public/users/${userId}`, {}, 'Failed to load public profile');
  } catch (error) {
    console.error('Get public profile error:', error);
    throw error;
  }
}

export async function searchArtists(query) {
  try {
    const data = await apiRequest(`/api/artists/search?q=${encodeURIComponent(query)}`, {}, 'Search failed');
    return data.artists || [];
  } catch (error) {
    console.error('Search artists error:', error);
    return [];
  }
}

export async function createArtist(artistData) {
  try {
    const result = await apiRequest('/api/artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artistData)
    }, 'Failed to create artist');
    clearPublicCache();
    return result;
  } catch (error) {
    console.error('Create artist error:', error);
    throw error;
  }
}

export async function uploadCover(file) {
  const formData = new FormData();
  formData.append('cover', file);

  try {
    return await apiRequest('/api/upload/cover', {
      method: 'POST',
      body: formData
    }, 'Upload failed');
  } catch (error) {
    console.error('Upload cover error:', error);
    throw error;
  }
}

export async function uploadArtistImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  try {
    return await apiRequest('/api/upload/artist', {
      method: 'POST',
      body: formData
    }, 'Upload failed');
  } catch (error) {
    console.error('Upload artist image error:', error);
    throw error;
  }
}

export async function createTrack(trackData) {
  try {
    const result = await apiRequest('/api/tracks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackData)
    }, 'Failed to create track');
    clearPublicCache();
    return result;
  } catch (error) {
    console.error('Create track error:', error);
    throw error;
  }
}

export async function getArtistWithStats(artistId) {
  try {
    return await apiRequest(`/api/artists/${artistId}/stats`, {}, 'Failed to fetch artist stats');
  } catch (error) {
    console.error('Get artist stats error:', error);
    throw error;
  }
}

export async function logout() {
  try {
    const data = await apiRequest('/api/logout', { method: 'POST' }, 'Logout failed');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    csrfTokenCache = '';
    try {
      sessionStorage.removeItem('MI_LAST_USER');
    } catch {
      // Ignore storage errors silently
    }
    clearPublicCache();
    return data;
  } catch (error) {
    console.error('Logout error:', error);
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    csrfTokenCache = '';
    try {
      sessionStorage.removeItem('MI_LAST_USER');
    } catch {
      // Ignore storage errors silently
    }
    clearPublicCache();
    throw error;
  }
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);

  try {
    return await apiRequest('/api/upload/avatar', {
      method: 'POST',
      body: formData
    }, 'Upload failed');
  } catch (error) {
    console.error('Upload avatar error:', error);
    throw error;
  }
}

export async function getUserStats(userId) {
  try {
    return await apiRequest(`/api/users/${userId}/stats`, {}, 'Failed to get user stats');
  } catch (error) {
    console.error('Get user stats error:', error);
    throw error;
  }
}

export async function getUserReviews(userId) {
  try {
    return await apiRequest(`/api/users/${userId}/reviews`, {}, 'Failed to get user reviews');
  } catch (error) {
    console.error('Get user reviews error:', error);
    throw error;
  }
}

export async function getUserReleases(userId) {
  try {
    return await apiRequest(`/api/users/${userId}/releases`, {}, 'Failed to get user releases');
  } catch (error) {
    console.error('Get user releases error:', error);
    throw error;
  }
}

export async function getReviewModerationQueue() {
  try {
    return await apiRequest('/api/admin/reviews/moderation-queue', {}, 'Failed to get review moderation queue');
  } catch (error) {
    console.error('Get review moderation queue error:', error);
    throw error;
  }
}

export async function approveReview(reviewId) {
  try {
    return await apiRequest(`/api/admin/reviews/${reviewId}/approve`, { method: 'POST' }, 'Failed to approve review');
  } catch (error) {
    console.error('Approve review error:', error);
    throw error;
  }
}

export async function rejectReview(reviewId, reason) {
  try {
    return await apiRequest(`/api/admin/reviews/${reviewId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    }, 'Failed to reject review');
  } catch (error) {
    console.error('Reject review error:', error);
    throw error;
  }
}
