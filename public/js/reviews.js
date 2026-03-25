 // Function to trim text to 300 characters, considering spaces and punctuation
function trimText(text, maxLength = 300) {
  if (text.length <= maxLength) return text;
  let trimmed = text.substring(0, maxLength);
  // Find the last space or punctuation to avoid cutting words
  const lastSpace = trimmed.lastIndexOf(' ');
  const lastPunct = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'));
  const cutIndex = Math.max(lastSpace, lastPunct);
  if (cutIndex > maxLength * 0.8) { // Only cut if it's not too far back
    trimmed = trimmed.substring(0, cutIndex + 1);
  }
  return trimmed + '...';
}

// Function to get avatar URL
function getAvatarUrl(avatar) {
  if (!avatar) return 'svg/person.png';
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/')) {
    return avatar;
  }
  if (avatar.startsWith('uploads/')) {
    return avatar;
  }
  return `uploads/avatars/${avatar}`;
}

// Function to render a single review card
export function renderReviewCard(review) {
  // Map API fields to expected format
  const reviewText = review.text || '';
  const trimmedText = trimText(reviewText);
  const isExpanded = false; // Initially not expanded
  
  // Get subscores from API (score1-score5) or fallback to array
  const subscores = review.subscores || [
    review.score1 || 0,
    review.score2 || 0,
    review.score3 || 0,
    review.score4 || 0,
    review.score5 || 0
  ].filter(s => s > 0);
  const subscoresStr = subscores.length > 0 ? subscores.join(' ') : '';
  
  // Get score (avg_score from API or calculated)
  const score = review.avg_score || review.score || (subscores.length > 0 
    ? Math.round((subscores.reduce((a, b) => a + b, 0) / subscores.length) * 10) / 10 
    : 0);
  
  // Get author name
  const author = review.author_name || review.author || 'Анонимный пользователь';
  
  // Get author avatar
  const authorAvatar = getAvatarUrl(review.author_avatar);
  
  // Get cover image from track
  const cover = review.track_cover || review.cover || 'svg/album.png';
  
  // Get title (use track title if no review title)
  const title = review.title || `${review.track_title || 'Рецензия'} - ${review.track_artist || ''}`;
  
  // Check if MI review
  const isMIReview = review.is_mi_review || review.miBadge || false;
  
  // Get track ID for clickable cover
  const trackId = review.track_id || null;

  return `
    <div class="review-card" data-id="${review.id}" data-track-id="${trackId}" data-full-text="${reviewText}">
      <div class="review-top">
        <div class="review-author">
          <img src="${authorAvatar}" alt="avatar" class="review-avatar" onerror="this.src='svg/person.png'">
          <div class="review-author-name">
            ${author} ${isMIReview ? '<span class="mi-badge">MI</span>' : ''}
          </div>
        </div>
        <div class="review-right">
          <div class="review-scores">
            <div class="review-score">${Math.round(score * 10) / 10}</div>
            ${subscoresStr ? `<div class="review-subscores">${subscoresStr}</div>` : ''}
          </div>
          ${trackId ? `<a href="track.html?id=${trackId}" class="review-cover-link"><img src="${cover}" class="review-cover" alt="cover" onerror="this.src='svg/album.png'"></a>` : `<img src="${cover}" class="review-cover" alt="cover" onerror="this.src='svg/album.png'">`}
        </div>
      </div>
      <div class="review-body">
        <div class="review-title">${title}</div>
        <div class="review-text">${trimmedText}</div>
      </div>
      <div class="review-footer">
        <button class="review-btn expand">${isExpanded ? '⤡' : '⤢'}</button>
      </div>
    </div>
  `;
}

// Function to render all review cards into the reviews-grid
export function renderReviews(reviews, container) {
  const html = reviews.map(renderReviewCard).join('');
  container.innerHTML = html;
}

// Function to handle expand/collapse with event delegation
export function initReviewExpand(container) {
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('expand')) {
      const card = e.target.closest('.review-card');
      const textEl = card.querySelector('.review-text');
      const btn = e.target;

      if (card.classList.contains('expanded')) {
        // Collapse
        card.classList.remove('expanded');
        btn.textContent = '⤢';
        // Reset to trimmed text
        const fullText = card.dataset.fullText;
        textEl.textContent = trimText(fullText);
      } else {
        // Expand
        card.classList.add('expanded');
        btn.textContent = '⤡';
        // Show full text
        const fullText = card.dataset.fullText;
        textEl.textContent = fullText;
      }
    }
  });
}

// Function to handle opening full review page
export function initReviewOpen(container) {
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('open')) {
      const card = e.target.closest('.review-card');
      const reviewId = card.dataset.id;
      window.location.href = `review.html?id=${reviewId}`;
    }
  });
}
