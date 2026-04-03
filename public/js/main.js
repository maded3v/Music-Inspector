import { getReviews, getReleases, getTopReleases } from './api.js?v=20260412';
import { renderReviews, initReviewExpand, initReviewOpen } from './reviews.js?v=20260412';
import { renderMonthlyReleases } from './releases.js?v=20260412';
import { renderReleaseCards } from './components/releaseCard.js?v=20260412';
import { initSearch } from './search.js';
import { initTiltEffect } from './tilt-effect.js';
import { initAuthStatus } from './auth-status.js?v=20260412';

// Function to render last added releases (both tracks and albums)
function renderLastAddedReleases(releases, container) {
  if (!releases || releases.length === 0) {
    container.innerHTML = '<div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">Пока нет добавленных релизов</div>';
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
  // Load data in parallel
  const [reviews, releases, topReleases] = await Promise.all([
    getReviews(),
    getReleases(),
    getTopReleases().catch((error) => {
      console.error('Error loading top releases:', error);
      return [];
    })
  ]);

  // Load and render reviews (limit to 2)
  const reviewsContainer = document.querySelector('.reviews-grid');
  if (reviewsContainer) {
    const limitedReviews = reviews.slice(0, 2);
    renderReviews(limitedReviews, reviewsContainer);
    initReviewExpand(reviewsContainer);
    initReviewOpen(reviewsContainer);
  }

  // Load and render latest releases (both tracks and albums)
  const lastAddedTracksContainer = document.querySelector('.last-added-tracks');
  if (lastAddedTracksContainer) {
    // Show all releases (tracks and albums), sort by newest first
    const allReleases = releases
      .slice()
      .sort((a, b) => new Date(b.created_at || b.releaseDate || 0) - new Date(a.created_at || a.releaseDate || 0));
    
    renderLastAddedReleases(allReleases, lastAddedTracksContainer);
  }

  // Load and render top releases (6 highest-rated cards)
  const releasesContainer = document.querySelector('.main-content');
  if (releasesContainer) {
    const releasesSection = document.createElement('div');
    releasesSection.classList.add('monthly-releases-container');
    releasesContainer.appendChild(releasesSection);
    
    try {
      const monthlyReleases = window.matchMedia('(max-width: 768px)').matches
        ? topReleases.slice(0, 3)
        : topReleases;

      renderMonthlyReleases(monthlyReleases, releasesSection);

      // Initialize tilt effect after cards are rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => initTiltEffect());
      });
    } catch (error) {
      releasesSection.innerHTML = `
        <div class="monthly-releases">
          <div class="monthly-releases-title">Лучшие релизы</div>
          <div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">
            Ошибка загрузки лучших релизов
          </div>
        </div>
      `;
    }
  }

  // Initialize search with tracks and releases data after cards are in DOM
  requestAnimationFrame(() => {
    const tracks = Array.from(document.querySelectorAll('.track-card')).map(card => ({
      title: card.querySelector('.track-title')?.textContent || '',
      artist: card.querySelector('.track-artist')?.textContent || '',
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
      const firstCard = trackWrapper.querySelector('.track-card-link, .track-card');
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

    window.addEventListener('resize', updateCarousel, { passive: true });
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
