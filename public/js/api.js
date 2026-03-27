// API base URL (empty for same origin)
const API_BASE = '';

// API wrapper functions

async function parseErrorResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const errorData = await response.json().catch(() => ({}));
    return errorData.error || fallbackMessage;
  }

  const bodyText = await response.text().catch(() => '');
  if (bodyText.includes('Vercel Security Checkpoint') || response.headers.get('x-vercel-mitigated')) {
    return 'Vercel Security Checkpoint блокирует API. Отключите защиту проекта в Vercel.';
  }

  return fallbackMessage;
}

/**
 * Get monthly albums (exactly 6 highest-rated from current month)
 */
export async function getMonthlyAlbums() {
  try {
    const response = await fetch(`${API_BASE}/api/tracks/monthly-albums`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.albums || [];
  } catch (error) {
    console.error('Error fetching monthly albums:', error);
    return [];
  }
}

/**
 * Get latest releases/tracks
 */
export async function getReleases() {
  try {
    const response = await fetch(`${API_BASE}/api/tracks/latest`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.tracks || [];
  } catch (error) {
    console.error('Error fetching releases:', error);
    return [];
  }
}

/**
 * Get latest reviews
 */
export async function getReviews() {
  try {
    const response = await fetch(`${API_BASE}/api/reviews/latest`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.reviews || [];
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

/**
 * Get a single review by ID
 */
export async function getReview(id) {
  try {
    const response = await fetch(`${API_BASE}/api/reviews/by-track/${id}`);
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    return data.reviews?.[0] || null;
  } catch (error) {
    console.error('Error fetching review:', error);
    return null;
  }
}

/**
 * Get a single track by ID
 */
export async function getTrack(id) {
  try {
    const response = await fetch(`${API_BASE}/api/tracks/${id}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching track:', error);
    throw error;
  }
}

/**
 * Get reviews for a specific track
 */
export async function getReviewsByTrack(trackId) {
  try {
    const response = await fetch(`${API_BASE}/api/reviews/by-track/${trackId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    // If it's a network error, provide a more helpful message
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.');
      networkError.status = 0;
      throw networkError;
    }
    throw error;
  }
}

/**
 * Add a review to a track
 */
export async function addReview(reviewData) {
  try {
    const response = await fetch(`${API_BASE}/api/reviews/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reviewData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    return await response.json();
  } catch (error) {
    console.error('Error adding review:', error);
    throw error;
  }
}

/**
 * Generate an AI review for a track
 */
export async function generateMIReview(data) {
  try {
    const response = await fetch(`${API_BASE}/api/mi-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate review');
    }
    return await response.json();
  } catch (error) {
    console.error('Error generating MI review:', error);
    throw error;
  }
}

/**
 * Login user
 */
export async function login(credentials) {
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    });
    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response, 'Login failed');
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

/**
 * Register new user
 */
export async function register(payload) {
  try {
    const response = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response, 'Registration failed');
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

/**
 * Get current user with role
 */
export async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE}/api/user/current`, {
      credentials: 'include'
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Search artists (for autocomplete)
 */
export async function searchArtists(query) {
  try {
    const response = await fetch(`${API_BASE}/api/artists/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    return data.artists || [];
  } catch (error) {
    console.error('Search artists error:', error);
    return [];
  }
}

/**
 * Create artist
 */
export async function createArtist(artistData) {
  try {
    const response = await fetch(`${API_BASE}/api/artists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(artistData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create artist');
    }
    return await response.json();
  } catch (error) {
    console.error('Create artist error:', error);
    throw error;
  }
}

/**
 * Upload cover image
 */
export async function uploadCover(file) {
  try {
    const formData = new FormData();
    formData.append('cover', file);

    const response = await fetch(`${API_BASE}/api/upload/cover`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return await response.json();
  } catch (error) {
    console.error('Upload cover error:', error);
    throw error;
  }
}

/**
 * Upload artist image
 */
export async function uploadArtistImage(file) {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/api/upload/artist`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return await response.json();
  } catch (error) {
    console.error('Upload artist image error:', error);
    throw error;
  }
}

/**
 * Create track/release
 */
export async function createTrack(trackData) {
  try {
    const response = await fetch(`${API_BASE}/api/tracks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(trackData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    return await response.json();
  } catch (error) {
    console.error('Create track error:', error);
    throw error;
  }
}

/**
 * Get artist with stats (overall rating, my rating, releases)
 */
export async function getArtistWithStats(artistId) {
  try {
    const response = await fetch(`${API_BASE}/api/artists/${artistId}/stats`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    return await response.json();
  } catch (error) {
    console.error('Get artist stats error:', error);
    throw error;
  }
}

/**
 * Logout user
 */
export async function logout() {
  try {
    // Call backend logout endpoint to clear httpOnly cookie
    const response = await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Logout failed');
    }
    
    // Also clear any client-side token storage
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    return await response.json();
  } catch (error) {
    console.error('Logout error:', error);
    // Even if backend call fails, clear client-side cookie
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    throw error;
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(file) {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE}/api/upload/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return await response.json();
  } catch (error) {
    console.error('Upload avatar error:', error);
    throw error;
  }
}

/**
 * Get user's statistics
 */
export async function getUserStats(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}/stats`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user stats');
    }
    return await response.json();
  } catch (error) {
    console.error('Get user stats error:', error);
    throw error;
  }
}

/**
 * Get user's reviews
 */
export async function getUserReviews(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}/reviews`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user reviews');
    }
    return await response.json();
  } catch (error) {
    console.error('Get user reviews error:', error);
    throw error;
  }
}

/**
 * Get user's releases
 */
export async function getUserReleases(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}/releases`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user releases');
    }
    return await response.json();
  } catch (error) {
    console.error('Get user releases error:', error);
    throw error;
  }
}

/**
 * Get review moderation queue (admin only)
 */
export async function getReviewModerationQueue() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/reviews/moderation-queue`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get review moderation queue');
    }
    return await response.json();
  } catch (error) {
    console.error('Get review moderation queue error:', error);
    throw error;
  }
}

/**
 * Approve review (admin only)
 */
export async function approveReview(reviewId) {
  try {
    const response = await fetch(`${API_BASE}/api/admin/reviews/${reviewId}/approve`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve review');
    }
    return await response.json();
  } catch (error) {
    console.error('Approve review error:', error);
    throw error;
  }
}

/**
 * Reject review (admin only)
 */
export async function rejectReview(reviewId, reason) {
  try {
    const response = await fetch(`${API_BASE}/api/admin/reviews/${reviewId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject review');
    }
    return await response.json();
  } catch (error) {
    console.error('Reject review error:', error);
    throw error;
  }
}
