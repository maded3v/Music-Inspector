/**
 * Unified Release Card Component
 * Used across all sections: Latest releases, Albums of the month, Artist pages
 */

/**
 * Normalize cover image path
 */
function normalizeCoverPath(cover) {
  if (!cover) return 'svg/album.png';
  
  if (cover.startsWith('http://') || cover.startsWith('https://') || cover.startsWith('/')) {
    return cover;
  }
  
  if (cover.startsWith('uploads/') || cover.startsWith('traks/') || cover.startsWith('svg/')) {
    return cover;
  }
  
  return `uploads/covers/${cover}`;
}

/**
 * Get badge icon SVG based on release type
 */
function getBadgeIcon(type) {
  if (type === 'single') {
    return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <path d="M406.3 48.2c-4.7.9-202 39.2-206.2 40-4.2.8-8.1 3.6-8.1 8v240.1c0 1.6-.1 7.2-2.4 11.7-3.1 5.9-8.5 10.2-16.1 12.7-3.3 1.1-7.8 2.1-13.1 3.3-24.1 5.4-64.4 14.6-64.4 51.8 0 31.1 22.4 45.1 41.7 47.5 2.1.3 4.5.7 7.1.7 6.7 0 36-3.3 51.2-13.2 11-7.2 24.1-21.4 24.1-47.8V190.5c0-3.8 2.7-7.1 6.4-7.8l152-30.7c5-1 9.6 2.8 9.6 7.8v130.9c0 4.1-.2 8.9-2.5 13.4-3.1 5.9-8.5 10.2-16.2 12.7-3.3 1.1-8.8 2.1-14.1 3.3-24.1 5.4-64.4 14.5-64.4 51.7 0 33.7 25.4 47.2 41.8 48.3 6.5.4 11.2.3 19.4-.9s23.5-5.5 36.5-13c17.9-10.3 27.5-26.8 27.5-48.2V55.9c-.1-4.4-3.8-8.9-9.8-7.7z"></path>
    </svg>`;
  }
  
  return `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11.99" cy="11.99" r="2.01"></circle>
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
    <path d="M12 6a6 6 0 0 0-6 6h2a4 4 0 0 1 4-4z"></path>
  </svg>`;
}

/**
 * Render unified release card
 * @param {Object} release - Release data object
 * @param {string} variant - Card variant: 'default' | 'monthly' | 'artist'
 * @returns {string} HTML string
 */
export function renderReleaseCard(release, variant = 'default') {
  // Skip invalid releases
  if (!release || typeof release !== 'object') {
    return '';
  }
  
  const releaseId = release.id || release.track_id;
  
  // Skip if no valid ID
  if (!releaseId) {
    return '';
  }
  
  const releaseType = release.type || 'single';
  const title = release.title;
  
  // Skip if no title (required field)
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return '';
  }
  
  const artistName = release.artist_name || release.artist || 'Неизвестный исполнитель';
  const artistId = release.artist_id || null;
  
  // Normalize cover path
  const cover = normalizeCoverPath(release.cover || release.cover_path);
  
  // Get ratings
  const peopleRating = release.peopleScore !== null && release.peopleScore !== undefined ? release.peopleScore : null;
  const miRating = release.miScore !== null && release.miScore !== undefined ? release.miScore : null;
  
  // Calculate average rating for monthly variant
  let averageRating = null;
  if (variant === 'monthly') {
    if (peopleRating !== null && miRating !== null) {
      averageRating = Math.round((peopleRating + miRating) / 2);
    } else if (peopleRating !== null) {
      averageRating = Math.round(peopleRating);
    } else if (miRating !== null) {
      averageRating = Math.round(miRating);
    }
  }
  
  // Badge icon
  const badgeIcon = getBadgeIcon(releaseType);
  
  // Base card classes
  const cardClass = variant === 'monthly' ? 'release-card' : 'track-card';
  
  // Avoid nested links inside the card link (invalid HTML causes layout glitches)
  const artistClass = variant === 'monthly' ? 'release-artist album-artist' : 'track-artist';
  const artistSection = `<div class="${artistClass}" data-artist-id="${artistId || ''}">${artistName}</div>`;
  
  // Build score section for monthly
  const scoreSection = variant === 'monthly' && averageRating !== null 
    ? `<div class="monthly-release-score album-score">${averageRating}</div>` 
    : '';
  
  // Build badges section for non-monthly
  let badgesSection = '';
  if (variant !== 'monthly') {
    const peopleBadge = peopleRating !== null ? `<div class="rewiews-badge-people">${Math.round(peopleRating)}</div>` : '';
    const miBadge = miRating !== null ? `<div class="rewiews-badge-MI">${Math.round(miRating)}</div>` : '';
    badgesSection = `<div class="rewiews-badges">${peopleBadge}${miBadge}</div>`;
  }
  
  // Return compact HTML without extra whitespace
  return `<a href="track.html?id=${releaseId}" class="${variant === 'monthly' ? 'release-card-link' : 'track-card-link'}"><div class="${cardClass}" data-type="${releaseType}" data-id="${releaseId}"><div class="${variant === 'monthly' ? 'release-cover-wrapper' : 'track-cover-wrapper'}"><img src="${cover}" alt="Обложка" class="${variant === 'monthly' ? 'release-cover' : 'track-cover'}" loading="lazy" decoding="async" width="161" height="161" onerror="this.onerror=null; this.src='svg/album.png';"><div class="${variant === 'monthly' ? 'release-badge' : 'track-badge'}">${badgeIcon}</div></div><div class="${variant === 'monthly' ? 'release-info' : 'track-info'}"><div class="${variant === 'monthly' ? 'release-title album-title' : 'track-title'}">${title}</div>${artistSection}</div>${scoreSection}${badgesSection}</div></a>`;
}

/**
 * Render multiple release cards
 * @param {Array} releases - Array of release objects
 * @param {string} variant - Card variant
 * @returns {string} HTML string
 */
export function renderReleaseCards(releases, variant = 'default') {
  if (!releases || !Array.isArray(releases) || releases.length === 0) {
    return '';
  }
  // Filter out invalid releases and render
  return releases
    .filter(release => release && (release.id || release.track_id))
    .map(release => renderReleaseCard(release, variant))
    .join('');
}







