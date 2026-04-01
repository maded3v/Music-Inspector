import { resolveMediaUrl } from './api.js';

function trimText(text, maxLength = 220) {
  if (text.length <= maxLength) return text;

  let trimmed = text.substring(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(' ');
  const lastPunct = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'));
  const cutIndex = Math.max(lastSpace, lastPunct);

  if (cutIndex > maxLength * 0.8) {
    trimmed = trimmed.substring(0, cutIndex + 1);
  }

  return `${trimmed}...`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAvatarUrl(avatar) {
  if (!avatar) return 'svg/person.png';
  if (avatar.startsWith('svg/')) return avatar;
  return resolveMediaUrl(avatar);
}

function getExpandIcon(isExpanded) {
  return isExpanded ? '-' : '+';
}

export function renderReviewCard(review) {
  const reviewText = String(review.text || '');
  const trimmedText = trimText(reviewText);
  const encodedFullText = encodeURIComponent(reviewText);

  const subscores = review.subscores || [
    review.score1 || 0,
    review.score2 || 0,
    review.score3 || 0,
    review.score4 || 0,
    review.score5 || 0
  ].filter((score) => score > 0);

  const subscoresStr = subscores.length > 0 ? subscores.join(' ') : '';

  const score = review.avg_score || review.score || (
    subscores.length > 0
      ? Math.round((subscores.reduce((sum, item) => sum + item, 0) / subscores.length) * 10) / 10
      : 0
  );

  const author = review.author_name || review.author || 'Неизвестный автор';
  const authorAvatar = getAvatarUrl(review.author_avatar);
  const cover = resolveMediaUrl(review.track_cover || review.cover) || 'svg/album.png';
  const title = review.title || `${review.track_title || 'Релиз'} - ${review.track_artist || ''}`;
  const isMIReview = Boolean(review.is_mi_review || review.miBadge);
  const trackId = review.track_id || null;

  const authorProfileUrl = review.user_id ? `profile.html?id=${review.user_id}` : '';
  const authorMarkup = review.user_id
    ? `<a href="${authorProfileUrl}" class="review-author-link"><img src="${authorAvatar}" alt="avatar" class="review-avatar" onerror="this.src='svg/person.png'"><div class="review-author-name">${escapeHtml(author)} ${isMIReview ? '<span class="mi-badge">MI</span>' : ''}</div></a>`
    : `<div class="review-author-link is-static"><img src="${authorAvatar}" alt="avatar" class="review-avatar" onerror="this.src='svg/person.png'"><div class="review-author-name">${escapeHtml(author)} ${isMIReview ? '<span class="mi-badge">MI</span>' : ''}</div></div>`;

  return `
    <div class="review-card" data-id="${review.id}" data-track-id="${trackId}" data-full-text="${encodedFullText}">
      <div class="review-top">
        <div class="review-author">${authorMarkup}</div>
        <div class="review-right">
          <div class="review-scores">
            <div class="review-score">${Math.round(score * 10) / 10}</div>
            ${subscoresStr ? `<div class="review-subscores">${subscoresStr}</div>` : ''}
          </div>
          ${trackId
            ? `<a href="track.html?id=${trackId}" class="review-cover-link"><img src="${cover}" class="review-cover" alt="cover" onerror="this.src='svg/album.png'"></a>`
            : `<img src="${cover}" class="review-cover" alt="cover" onerror="this.src='svg/album.png'">`}
        </div>
      </div>
      <div class="review-body">
        <div class="review-title">${escapeHtml(title)}</div>
        <div class="review-text">${escapeHtml(trimmedText)}</div>
      </div>
      <div class="review-footer">
        <button class="review-btn expand" aria-label="Expand">${getExpandIcon(false)}</button>
      </div>
    </div>
  `;
}

function syncReviewExpandButtons(container) {
  const cards = container.querySelectorAll('.review-card');

  cards.forEach((card) => {
    const textEl = card.querySelector('.review-text');
    const btn = card.querySelector('.review-btn.expand');
    if (!textEl || !btn) return;

    let fullText = '';
    try {
      fullText = decodeURIComponent(card.dataset.fullText || '');
    } catch {
      fullText = card.dataset.fullText || '';
    }

    const trimmed = trimText(fullText);
    card.classList.remove('expanded');
    textEl.textContent = trimmed;
    btn.textContent = getExpandIcon(false);
    btn.setAttribute('aria-label', 'Expand');

    const overflowByLength = trimmed !== fullText;
    const overflowByLayout = textEl.scrollHeight > textEl.clientHeight + 1;

    if (!overflowByLength && !overflowByLayout) {
      textEl.textContent = fullText;
      btn.remove();
    }
  });
}

export function renderReviews(reviews, container) {
  container.innerHTML = reviews.map(renderReviewCard).join('');

  requestAnimationFrame(() => {
    syncReviewExpandButtons(container);
  });
}

export function initReviewExpand(container) {
  if (!container || container.dataset.expandBound === '1') {
    return;
  }

  container.dataset.expandBound = '1';

  container.addEventListener('click', (event) => {
    if (!event.target.classList.contains('expand')) {
      return;
    }

    const card = event.target.closest('.review-card');
    if (!card) return;

    const textEl = card.querySelector('.review-text');
    const btn = event.target;
    if (!textEl || !btn) return;

    let fullText = '';
    try {
      fullText = decodeURIComponent(card.dataset.fullText || '');
    } catch {
      fullText = card.dataset.fullText || '';
    }

    if (card.classList.contains('expanded')) {
      card.classList.remove('expanded');
      btn.textContent = getExpandIcon(false);
      btn.setAttribute('aria-label', 'Expand');
      textEl.textContent = trimText(fullText);
    } else {
      card.classList.add('expanded');
      btn.textContent = getExpandIcon(true);
      btn.setAttribute('aria-label', 'Collapse');
      textEl.textContent = fullText;
    }
  });
}

export function initReviewOpen(container) {
  container.addEventListener('click', (event) => {
    if (!event.target.classList.contains('open')) {
      return;
    }

    const card = event.target.closest('.review-card');
    const reviewId = card?.dataset.id;
    if (!reviewId) return;

    window.location.href = `review.html?id=${reviewId}`;
  });
}
