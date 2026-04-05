import { getReviews, getReleases, getTopReleases } from './api.js?v=20260421';
import { renderReviews, initReviewExpand, initReviewOpen } from './reviews.js?v=20260421';
import { renderMonthlyReleases } from './releases.js?v=20260421';
import { renderReleaseCards } from './components/releaseCard.js?v=20260421';
import { initSearch } from './search.js?v=20260421';
import { initTiltEffect } from './tilt-effect.js';
import { initAuthStatus } from './auth-status.js?v=20260421';

function renderState(container, message, type = 'default') {
  if (!container) return;

  const typeClass = type === 'error' ? ' mi-state--error' : '';
  container.innerHTML = `<div class="mi-state${typeClass}">${message}</div>`;
}

function renderReviewSkeletons(container, count = 2) {
  if (!container) return;

  container.innerHTML = Array.from({ length: count }).map(() => `
    <article class="review-card mi-skeleton">
      <div class="review-top" style="background: rgba(42, 42, 42, 0.55);">
        <div class="mi-skeleton-block is-mid"></div>
        <div class="mi-skeleton-block is-short" style="width: 60px;"></div>
      </div>
      <div class="review-body" style="display: grid; gap: 8px; margin-top: 10px;">
        <div class="mi-skeleton-block is-full"></div>
        <div class="mi-skeleton-block is-mid"></div>
        <div class="mi-skeleton-block is-full"></div>
      </div>
    </article>
  `).join('');
}

function renderReleaseSkeletons(container, count = 6) {
  if (!container) return;

  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="track-card track-card-home track-card-placeholder mi-skeleton">
      <div class="track-cover-wrapper"><div class="placeholder-cover"></div></div>
      <div class="track-info">
        <div class="mi-skeleton-block is-mid"></div>
        <div class="mi-skeleton-block is-short"></div>
      </div>
    </div>
  `).join('');
}

function renderTopSkeleton(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="monthly-releases mi-shell">
      <div class="monthly-releases-title mi-shell-title">Лучшие релизы</div>
      <div class="monthly-releases-grid">
        ${Array.from({ length: 6 }).map(() => `
          <div class="release-card release-card-placeholder mi-skeleton">
            <div class="release-cover-wrapper"><div class="placeholder-cover"></div></div>
            <div class="release-info" style="width: 100%; gap: 8px; margin-top: 8px;">
              <div class="mi-skeleton-block is-mid"></div>
              <div class="mi-skeleton-block is-short"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Function to render last added releases (both tracks and albums)
function renderLastAddedReleases(releases, container) {
  if (!Array.isArray(releases) || releases.length === 0) {
    renderState(container, 'Пока нет добавленных релизов');
    return;
  }

  // Use unified release card component
  container.innerHTML = renderReleaseCards(releases, 'home');
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and update UI
  const currentUser = await initAuthStatus();

  // Show "Add Release" button if logged in
  const addReleaseBtn = document.getElementById('add-release-btn');
  if (currentUser && addReleaseBtn) {
    addReleaseBtn.classList.remove('is-hidden');
  }

  const reviewsContainer = document.querySelector('.reviews-grid');
  const lastAddedTracksContainer = document.querySelector('.last-added-tracks');
  const releasesContainer = document.querySelector('.main-content');

  let releasesSection = null;
  if (releasesContainer) {
    releasesSection = document.createElement('div');
    releasesSection.classList.add('monthly-releases-container');
    releasesContainer.appendChild(releasesSection);
  }

  renderReviewSkeletons(reviewsContainer);
  renderReleaseSkeletons(lastAddedTracksContainer);
  renderTopSkeleton(releasesSection);

  // Load data in parallel with section-safe fallbacks
  const [reviewsResult, releasesResult, topReleasesResult] = await Promise.all([
    getReviews()
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({ ok: false, error })),
    getReleases()
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({ ok: false, error })),
    getTopReleases()
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({ ok: false, error }))
  ]);

  if (!reviewsResult.ok) {
    console.error('Error loading reviews:', reviewsResult.error);
  }
  if (!releasesResult.ok) {
    console.error('Error loading releases:', releasesResult.error);
  }
  if (!topReleasesResult.ok) {
    console.error('Error loading top releases:', topReleasesResult.error);
  }

  const reviews = reviewsResult.ok && Array.isArray(reviewsResult.data) ? reviewsResult.data : [];
  const releases = releasesResult.ok && Array.isArray(releasesResult.data) ? releasesResult.data : [];
  const topReleases = topReleasesResult.ok && Array.isArray(topReleasesResult.data) ? topReleasesResult.data : [];

  // Load and render reviews (limit to 2)
  if (reviewsContainer) {
    if (!reviewsResult.ok) {
      renderState(reviewsContainer, 'Не удалось загрузить рецензии. Обновите страницу.', 'error');
    } else {
      const limitedReviews = reviews.slice(0, 2);
      renderReviews(limitedReviews, reviewsContainer);
      initReviewExpand(reviewsContainer);
      initReviewOpen(reviewsContainer);
    }
  }

  // Load and render latest releases (both tracks and albums)
  if (lastAddedTracksContainer) {
    if (!releasesResult.ok) {
      renderState(lastAddedTracksContainer, 'Не удалось загрузить релизы. Попробуйте позже.', 'error');
    } else {
      // Show all releases (tracks and albums), sort by newest first
      const allReleases = releases
        .slice()
        .sort((a, b) => new Date(b.created_at || b.releaseDate || 0) - new Date(a.created_at || a.releaseDate || 0));

      renderLastAddedReleases(allReleases, lastAddedTracksContainer);
    }
  }

  // Load and render top releases (6 highest-rated cards)
  if (releasesSection) {
    if (!topReleasesResult.ok) {
      releasesSection.innerHTML = '<div class="mi-state mi-state--error">Не удалось загрузить лучшие релизы</div>';
    } else {
      const monthlyReleases = window.matchMedia('(max-width: 768px)').matches
        ? topReleases.slice(0, 3)
        : topReleases;

      renderMonthlyReleases(monthlyReleases, releasesSection);

      // Initialize tilt effect after cards are rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => initTiltEffect());
      });
    }
  }

  // Initialize search with tracks and releases data after cards are in DOM
  requestAnimationFrame(() => {
    const tracks = Array.from(document.querySelectorAll('.track-card')).map(card => ({
      title: card.querySelector('.track-title')?.textContent || '',
      artist: card.querySelector('.track-artist, .release-artist, .album-artist')?.textContent || '',
      id: card.dataset.id || ''
    }));

    initSearch(tracks, releases);
  });

  // Preserve existing carousel logic
  const trackWrapper = document.querySelector(".last-added-tracks");
  const prevBtn = document.querySelector(".but-prev-last-added-tracks");
  const nextBtn = document.querySelector(".but-next-last-added-tracks");

  if (trackWrapper && prevBtn && nextBtn) {
    const isMobileViewport = () => window.matchMedia('(max-width: 900px)').matches;
    const MAX_PULL_OFFSET = 36;
    const PULL_RESISTANCE = 0.35;

    let touchStartX = 0;
    let pullOffset = 0;

    const getStep = () => {
      const firstCard = trackWrapper.querySelector('.track-card');
      if (!firstCard) {
        return 0;
      }

      const cardWidth = firstCard.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(trackWrapper).gap) || 16;
      return cardWidth + gap;
    };

    const getMaxOffset = () => {
      const raw = trackWrapper.scrollWidth - trackWrapper.clientWidth;
      return Math.max(0, Math.ceil(raw));
    };

    const updateCarousel = () => {
      const maxOffset = getMaxOffset();
      const currentOffset = trackWrapper.scrollLeft;

      const atStart = currentOffset <= 0;
      const atEnd = currentOffset >= maxOffset - 1;

      prevBtn.classList.toggle('is-disabled', atStart);
      nextBtn.classList.toggle('is-disabled', atEnd);
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
    };

    const applyPullOffset = (offset) => {
      pullOffset = offset;
      if (offset === 0) {
        trackWrapper.style.transform = '';
        return;
      }
      trackWrapper.style.transform = `translateX(${offset}px)`;
    };

    const releasePullOffset = () => {
      if (!pullOffset) return;
      trackWrapper.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      applyPullOffset(0);
      window.setTimeout(() => {
        trackWrapper.style.transition = '';
      }, 240);
    };

    const scrollByStep = (direction) => {
      const target = Math.max(0, Math.min(getMaxOffset(), trackWrapper.scrollLeft + getStep() * direction));
      trackWrapper.scrollTo({ left: target, behavior: 'smooth' });
    };

    nextBtn.addEventListener('click', () => {
      scrollByStep(1);
      updateCarousel();
    });

    prevBtn.addEventListener('click', () => {
      scrollByStep(-1);
      updateCarousel();
    });

    trackWrapper.addEventListener('scroll', updateCarousel, { passive: true });

    trackWrapper.addEventListener('touchstart', (event) => {
      if (!isMobileViewport() || !event.touches || event.touches.length !== 1) {
        return;
      }
      touchStartX = event.touches[0].clientX;
      trackWrapper.style.transition = '';
    }, { passive: true });

    trackWrapper.addEventListener('touchmove', (event) => {
      if (!isMobileViewport() || !event.touches || event.touches.length !== 1) {
        return;
      }

      const currentX = event.touches[0].clientX;
      const deltaX = currentX - touchStartX;
      const atStart = trackWrapper.scrollLeft <= 0;
      const atEnd = trackWrapper.scrollLeft >= getMaxOffset() - 1;

      const canPullRight = atStart && deltaX > 0;
      const canPullLeft = atEnd && deltaX < 0;

      if (canPullRight || canPullLeft) {
        event.preventDefault();
        const direction = canPullRight ? 1 : -1;
        const offset = Math.min(MAX_PULL_OFFSET, Math.abs(deltaX) * PULL_RESISTANCE) * direction;
        applyPullOffset(offset);
      }
    }, { passive: false });

    trackWrapper.addEventListener('touchend', releasePullOffset, { passive: true });
    trackWrapper.addEventListener('touchcancel', releasePullOffset, { passive: true });

    window.addEventListener('resize', () => {
      releasePullOffset();
      updateCarousel();
    }, { passive: true });
    window.addEventListener('load', updateCarousel, { passive: true });
    updateCarousel();
  }

  // Badges are now rendered by the unified component, no need for manual badge creation

  // Score calculation (assuming data-values attribute)
  document.querySelectorAll('.review-score').forEach(el => {
    if (el.dataset.values) {
      const nums = el.dataset.values.split(',').map(Number);
      const avg = Math.round(nums.reduce((a, b) => a + b) / nums.length * 10);
      el.textContent = avg;
    }
  });
});
