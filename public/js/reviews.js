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

// Function to render a single review card
export function renderReviewCard(review) {
  const trimmedText = trimText(review.text);
  const isExpanded = false; // Initially not expanded
  const subscoresStr = review.subscores.join(' ');

  return `
    <div class="review-card" data-id="${review.id}" data-full-text="${review.text}">
      <div class="review-top">
        <div class="review-author">
          <img src="${review.authorAvatar}" alt="avatar" class="review-avatar">
          <div class="review-author-name">
            ${review.author} ${review.miBadge ? '<span class="mi-badge">MI</span>' : ''}
          </div>
        </div>
        <div class="review-right">
          <div class="review-scores">
            <div class="review-score">${review.score}</div>
            <div class="review-subscores">${subscoresStr}</div>
          </div>
          <img src="${review.cover}" class="review-cover" alt="cover">
        </div>
      </div>
      <div class="review-body">
        <div class="review-title">${review.title}</div>
        <div class="review-text">${trimmedText}</div>
      </div>
      <div class="review-footer">
        <button class="review-btn expand">${isExpanded ? '⤡' : '⤢'}</button>
        <button class="review-btn open">🗖</button>
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
